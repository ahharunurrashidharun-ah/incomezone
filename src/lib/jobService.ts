import { supabase, toValidUUID } from './supabaseClient';
import {
  isTableMissingError,
  saveLocalJob,
  updateLocalJob,
  getLocalJobs,
  saveLocalSubmission,
  updateLocalSubmission,
  getLocalSubmissions,
  saveLocalDeposit,
  saveLocalWithdrawal,
  getLocalUser,
  saveLocalUser,
  saveLocalNotification,
} from './localFallbackStore';
import { attachImageToDescription } from './jobImages';
import { queueEmailNotification } from './notificationSender';
import { sendJobSubmissionAlert, sendJobPostedAlert } from '../utils/telegramNotifier';

export interface JobData {
  title: string;
  category: string;
  location: string;
  totalSlots: number;
  pricePerTask: number;
  requiredScreenshots?: number;
  requireTextProof?: boolean;
  textProofRequirement?: string;
  textProofInstruction?: string;
  text_proof_instruction?: string;
  screenshotInstructions?: string[];
  screenshot_instructions?: string[];
  jobImage?: string;
  imageUrl?: string;
  description: string;
  ownerId?: string;
  employerId?: string;
}

export interface SubmissionData {
  jobId: string;
  workerId: string;
  workerDisplayId?: string | number;
  workerName?: string;
  proofText: string;
  proofScreenshotUrl?: string;
  proofScreenshotUrls?: string[];
}

/**
 * Uploads a file to Supabase Storage 'uploads' bucket or fallback data URL.
 */
export async function uploadFile(file: File, folder = 'proofs'): Promise<string> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || 'anonymous';
    
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${userId}/${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error || !data) {
      throw new Error(error?.message || "Storage upload failed");
    }

    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (e) {
    throw e;
  }
}

/**
 * Posts a new job by deducting the total budget from user's deposit balance
 * and inserting the job in 'pending' status for admin approval.
 */
export async function postJob(jobData: JobData): Promise<string> {
  const rawId = jobData.ownerId || jobData.employerId || '';
  const ownerId = toValidUUID(rawId);
  const totalCost = Number(jobData.pricePerTask) * Number(jobData.totalSlots);
  const imgUrl = jobData.imageUrl || jobData.jobImage;

  try {
    // 1. Fetch current deposit balance with fallback
    let currentBalance = 0;
    const { data: userDoc } = await supabase
      .from('users')
      .select('deposit_balance')
      .eq('id', ownerId)
      .maybeSingle();

    if (userDoc) {
      currentBalance = Number(userDoc.deposit_balance ?? 0);
    } else {
      // Fallback to local user balance or 0 (strictly zero default balance)
      const localUser = getLocalUser(ownerId);
      currentBalance = Number(localUser?.deposit_balance || 0);
      try {
        await supabase.from('users').upsert({
          id: ownerId,
          email: `${ownerId}@incomezone.app`,
          name: 'User',
          username: 'user',
          deposit_balance: currentBalance,
          earning_balance: 0,
          role: 'user',
          is_locked: false,
        });
      } catch {}
    }

    if (currentBalance < totalCost) {
      throw new Error("Insufficient Deposit Balance");
    }

    const newDepositBalance = Math.max(0, currentBalance - totalCost);

    // 2. Deduct deposit balance in Supabase & local store
    try {
      await supabase
        .from('users')
        .update({ deposit_balance: newDepositBalance })
        .eq('id', ownerId);
    } catch {}

    saveLocalUser(ownerId, { deposit_balance: newDepositBalance });

    // 3. Insert Job into 'jobs' table strictly with snake_case columns
    const textProofInst = jobData.text_proof_instruction || jobData.textProofInstruction || jobData.textProofRequirement || '';
    const screenshotInsts = jobData.screenshot_instructions || jobData.screenshotInstructions || [];
    const descWithThumbnail = attachImageToDescription(jobData.description, imgUrl);

    const jobPayload: any = {
      title: jobData.title,
      description: descWithThumbnail,
      category: jobData.category,
      location: jobData.location || 'GLOBAL',
      total_slots: Number(jobData.totalSlots),
      occupied_slots: 0,
      price_per_task: Number(jobData.pricePerTask),
      required_screenshots: Number(jobData.requiredScreenshots || 0),
      require_text_proof: jobData.requireTextProof ?? true,
      text_proof_instruction: textProofInst,
      text_proof_requirement: textProofInst,
      screenshot_instructions: screenshotInsts,
      owner_id: ownerId,
      employer_id: ownerId,
      status: 'pending',
    };

    if (imgUrl) {
      jobPayload.image_url = imgUrl;
    }

    let insertedJob: any = null;
    try {
      const { data, error: jobError } = await supabase
        .from('jobs')
        .insert(jobPayload)
        .select('id')
        .maybeSingle();

      if (!jobError && data) {
        insertedJob = data;
      }
    } catch (insertCatch) {
      console.warn('Initial rich job insert notice, retrying core fields or local:', insertCatch);
    }

    // If initial insert had schema columns missing, retry with fields included
    if (!insertedJob) {
      try {
        const fallbackPayload: any = {
          title: jobData.title,
          description: descWithThumbnail,
          category: jobData.category,
          location: jobData.location || 'GLOBAL',
          total_slots: Number(jobData.totalSlots),
          occupied_slots: 0,
          price_per_task: Number(jobData.pricePerTask),
          required_screenshots: Number(jobData.requiredScreenshots || 0),
          require_text_proof: jobData.requireTextProof ?? true,
          text_proof_instruction: textProofInst,
          screenshot_instructions: screenshotInsts,
          owner_id: ownerId,
          employer_id: ownerId,
          status: 'pending',
        };
        if (imgUrl) {
          fallbackPayload.image_url = imgUrl;
        }

        const { data, error: fallbackError } = await supabase
          .from('jobs')
          .insert(fallbackPayload)
          .select('id')
          .maybeSingle();

        if (!fallbackError && data) {
          insertedJob = data;
        }
      } catch {}
    }

    // Fallback to local store
    const localSaved = saveLocalJob({
      id: insertedJob?.id,
      title: jobData.title,
      category: jobData.category,
      location: jobData.location || 'GLOBAL',
      total_slots: Number(jobData.totalSlots),
      occupied_slots: 0,
      price_per_task: Number(jobData.pricePerTask),
      required_screenshots: Number(jobData.requiredScreenshots || 0),
      require_text_proof: jobData.requireTextProof ?? true,
      text_proof_instruction: textProofInst,
      text_proof_requirement: textProofInst,
      screenshot_instructions: screenshotInsts,
      image_url: imgUrl,
      imageUrl: imgUrl,
      description: descWithThumbnail,
      owner_id: ownerId,
      employer_id: ownerId,
      status: 'pending',
    });

    const finalJobId = insertedJob?.id || localSaved.id;

    // Save in-app notification for employer
    saveLocalNotification(ownerId, {
      title: 'নতুন জব জমা হয়েছে! ⏳',
      message: `আপনার নতুন জব "${jobData.title}" সফলভাবে পর্যালোচনার জন্য জমা হয়েছে। অ্যাডমিন অনুমোদন দিলে এটি সরাসরি লাইভ হবে।`,
      type: 'announcement',
    });

    // Queue email alert to admin
    queueEmailNotification({
      subject: `[IncomeZone] New Job Submitted: ${jobData.title}`,
      message: `A new job has been submitted for review on IncomeZone.\n\nTitle: ${jobData.title}\nCategory: ${jobData.category}\nSlots: ${jobData.totalSlots}\nPrice/Task: $${Number(jobData.pricePerTask).toFixed(2)}\nTotal Budget: $${totalCost.toFixed(2)}\nEmployer ID: ${ownerId}\n\nPlease review and approve it from the Admin Panel.`,
      type: 'job_post',
    });

    // Direct Telegram Alert
    sendJobPostedAlert({
      title: jobData.title,
      category: jobData.category,
      pricePerTask: Number(jobData.pricePerTask),
      totalSlots: Number(jobData.totalSlots),
    });

    return finalJobId;
  } catch (err: any) {
    if (err?.message === "Insufficient Deposit Balance" || err?.message?.includes("Insufficient Deposit Balance")) {
      throw new Error("Insufficient Deposit Balance");
    }

    const textProofInst = jobData.text_proof_instruction || jobData.textProofInstruction || jobData.textProofRequirement || '';
    const screenshotInsts = jobData.screenshot_instructions || jobData.screenshotInstructions || [];
    const descWithThumbnail = attachImageToDescription(jobData.description, imgUrl);

    // Unconditional fallback so job creation NEVER fails
    const newJob = saveLocalJob({
      title: jobData.title,
      category: jobData.category,
      location: jobData.location || 'GLOBAL',
      total_slots: Number(jobData.totalSlots),
      occupied_slots: 0,
      price_per_task: Number(jobData.pricePerTask),
      required_screenshots: Number(jobData.requiredScreenshots || 0),
      require_text_proof: jobData.requireTextProof ?? true,
      text_proof_instruction: textProofInst,
      text_proof_requirement: textProofInst,
      screenshot_instructions: screenshotInsts,
      image_url: imgUrl,
      imageUrl: imgUrl,
      description: descWithThumbnail,
      owner_id: ownerId,
      employer_id: ownerId,
      status: 'pending',
    });

    saveLocalNotification(ownerId, {
      title: 'নতুন জব জমা হয়েছে! ⏳',
      message: `আপনার নতুন জব "${jobData.title}" সফলভাবে পর্যালোচনার জন্য জমা হয়েছে। অ্যাডমিন অনুমোদন দিলে এটি সরাসরি লাইভ হবে।`,
      type: 'announcement',
    });

    queueEmailNotification({
      subject: `[IncomeZone] New Job Submitted: ${jobData.title}`,
      message: `A new job has been submitted for review on IncomeZone.\n\nTitle: ${jobData.title}\nCategory: ${jobData.category}\nSlots: ${jobData.totalSlots}\nPrice/Task: $${Number(jobData.pricePerTask).toFixed(2)}\nTotal Budget: $${totalCost.toFixed(2)}\nEmployer ID: ${ownerId}\n\nPlease review and approve it from the Admin Panel.`,
      type: 'job_post',
    });

    return newJob.id;
  }
}

export const createJob = postJob;

/**
 * Submits work for a job, incrementing occupied slots and saving proof.
 */
export async function submitJob(subData: SubmissionData): Promise<string> {
  try {
    // 1. Fetch job to verify slot availability
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', subData.jobId)
      .single();

    if (jobError && isTableMissingError(jobError)) {
      // Local fallback
      const localJobs = getLocalJobs();
      const localJob = localJobs.find((j) => j.id === subData.jobId);
      if (!localJob) throw new Error('Job not found.');
      if (localJob.occupied_slots >= localJob.total_slots) {
        throw new Error('This job has no available slots left.');
      }
      const existing = getLocalSubmissions().find(
        (s) => s.job_id === subData.jobId && s.worker_id === subData.workerId
      );
      if (existing) {
        throw new Error('You have already submitted proof for this task.');
      }
      const newSub = saveLocalSubmission({
        job_id: subData.jobId,
        worker_id: subData.workerId,
        worker_display_id: subData.workerDisplayId,
        workerDisplayId: subData.workerDisplayId,
        proof_text: subData.proofText,
        proof_screenshot_url: subData.proofScreenshotUrl,
        status: 'pending',
      });
      updateLocalJob(subData.jobId, {
        occupied_slots: localJob.occupied_slots + 1,
        status: localJob.occupied_slots + 1 >= localJob.total_slots ? 'completed' : localJob.status,
      });
      return newSub.id;
    }

    if (!job) {
      throw new Error('Job not found.');
    }

    const occupiedSlots = Number(job.occupied_slots ?? job.occupiedSlots ?? 0);
    const totalSlots = Number(job.total_slots ?? job.totalSlots ?? 0);

    if (occupiedSlots >= totalSlots) {
      throw new Error('This job has no available slots left.');
    }

    // 1. Check if user already submitted locally
    const localSubs = getLocalSubmissions();
    const existingLocal = localSubs.find(
      (s: any) => (s.job_id === subData.jobId || s.jobId === subData.jobId) &&
                  (s.worker_id === subData.workerId || s.workerId === subData.workerId)
    );
    if (existingLocal) {
      throw new Error('আপনি ইতিমধ্যে এই জবের জন্য প্রুফ সাবমিট করেছেন! একই জব একাধিকবার সাবমিট করা যাবে না।');
    }

    // 2. Check if user already submitted for this job in Supabase
    try {
      const { data: existingSub } = await supabase
        .from('submissions')
        .select('id')
        .eq('job_id', subData.jobId)
        .eq('worker_id', subData.workerId)
        .maybeSingle();

      if (existingSub) {
        throw new Error('আপনি ইতিমধ্যে এই জবের জন্য প্রুফ সাবমিট করেছেন! একই জব একাধিকবার সাবমিট করা যাবে না।');
      }
    } catch (checkErr: any) {
      if (checkErr?.message?.includes('ইতিমধ্যে') || checkErr?.message?.includes('already')) {
        throw checkErr;
      }
    }

    // 3. Create submission record
    const primaryScreenshotUrl = subData.proofScreenshotUrl || (subData.proofScreenshotUrls && subData.proofScreenshotUrls[0]) || null;
    const allScreenshots = subData.proofScreenshotUrls && subData.proofScreenshotUrls.length > 0 
      ? subData.proofScreenshotUrls 
      : (primaryScreenshotUrl ? [primaryScreenshotUrl] : []);

    let newSubId: string = '';
    const resolvedWorkerDisplayId = subData.workerDisplayId ? String(subData.workerDisplayId) : undefined;

    try {
      const insertData: any = {
        job_id: subData.jobId,
        worker_id: subData.workerId,
        proof_text: subData.proofText,
        proof_screenshot_url: primaryScreenshotUrl,
        status: 'pending',
      };
      if (resolvedWorkerDisplayId) {
        insertData.worker_display_id = resolvedWorkerDisplayId;
      }

      const { data: newSub, error: subError } = await supabase
        .from('submissions')
        .insert(insertData)
        .select('id')
        .single();

      if (subError) {
        if (subError.code === '23505' || subError.message?.toLowerCase().includes('duplicate') || subError.message?.toLowerCase().includes('unique')) {
          throw new Error('আপনি ইতিমধ্যে এই জবের জন্য প্রুফ সাবমিট করেছেন! একই জব একাধিকবার সাবমিট করা যাবে না।');
        }
        if (resolvedWorkerDisplayId) {
          // Retry without worker_display_id column if table lacks that column
          const { data: retrySub, error: retryErr } = await supabase
            .from('submissions')
            .insert({
              job_id: subData.jobId,
              worker_id: subData.workerId,
              proof_text: subData.proofText,
              proof_screenshot_url: primaryScreenshotUrl,
              status: 'pending',
            })
            .select('id')
            .single();
          if (retryErr) {
            if (retryErr.code === '23505' || retryErr.message?.toLowerCase().includes('duplicate')) {
              throw new Error('আপনি ইতিমধ্যে এই জবের জন্য প্রুফ সাবমিট করেছেন! একই জব একাধিকবার সাবমিট করা যাবে না।');
            }
          } else if (retrySub) {
            newSubId = retrySub.id;
          }
        }
      } else if (newSub) {
        newSubId = newSub.id;
      }
    } catch (insertErr: any) {
      if (insertErr?.message?.includes('ইতিমধ্যে') || insertErr?.message?.includes('already') || insertErr?.code === '23505') {
        throw insertErr;
      }
    }

    const newLocalSub = saveLocalSubmission({
      id: newSubId,
      job_id: subData.jobId,
      worker_id: subData.workerId,
      worker_display_id: resolvedWorkerDisplayId,
      workerDisplayId: resolvedWorkerDisplayId,
      proof_text: subData.proofText,
      proof_screenshot_url: primaryScreenshotUrl,
      proof_screenshot_urls: allScreenshots,
      status: 'pending',
    });

    if (!newSubId) {
      newSubId = newLocalSub.id;
    }

    try {
      window.dispatchEvent(new CustomEvent('submission_updated', {
        detail: { jobId: subData.jobId, workerId: subData.workerId }
      }));
    } catch {}

    // 4. Increment occupied slots
    const newOccupied = occupiedSlots + 1;
    const isNowCompleted = newOccupied >= totalSlots;

    await supabase
      .from('jobs')
      .update({
        occupied_slots: newOccupied,
        ...(isNowCompleted ? { status: 'completed' } : {}),
      })
      .eq('id', subData.jobId);

    const jobTitle = job?.title || 'Micro-Job';
    const jobOwnerId = job?.owner_id || job?.employer_id;

    // 5. Save in-app notification for worker
    saveLocalNotification(subData.workerId, {
      title: 'টাস্ক সাবমিশন সফল হয়েছে! ⏳',
      message: `আপনার জব "${jobTitle}"-এর কাজের প্রমাণপত্র সফলভাবে জমা হয়েছে। নিয়োগকর্তা যাচাই করে অনুমোদন দিলে ব্যালেন্স জমা হবে।`,
      type: 'submission',
    });

    // 6. Save in-app notification for employer / job owner (only if different from worker)
    if (jobOwnerId && jobOwnerId !== subData.workerId) {
      saveLocalNotification(jobOwnerId, {
        title: 'নতুন টাস্ক সাবমিশন! 📋',
        message: `আপনার জব "${jobTitle}"-এ একজন কর্মী কাজের প্রমাণপত্র জমা দিয়েছেন। My Jobs থেকে পর্যালোচনা করুন।`,
        type: 'submission',
      });
    }

    // 7. Queue real-time email alert to admin
    queueEmailNotification({
      subject: `[IncomeZone] New Task Proof Submitted: ${jobTitle}`,
      message: `A worker has submitted proof for a job on IncomeZone.\n\nJob Title: ${jobTitle}\nJob ID: ${subData.jobId}\nWorker ID: ${subData.workerId}\nWorker Display ID: ${resolvedWorkerDisplayId || 'N/A'}\nProof Notes: ${subData.proofText}\nScreenshots: ${allScreenshots.length}\nSubmitted At: ${new Date().toLocaleString()}\n\nPlease review in Admin Panel or Employer My Jobs.`,
      type: 'task_submission',
    });

    // 8. Direct Telegram Alert to Admin
    sendJobSubmissionAlert({
      jobId: subData.jobId,
      jobTitle: jobTitle,
      workerId: subData.workerId,
      workerDisplayId: resolvedWorkerDisplayId,
      proofText: subData.proofText,
    });

    return newSubId;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      const newSub = saveLocalSubmission({
        job_id: subData.jobId,
        worker_id: subData.workerId,
        worker_display_id: subData.workerDisplayId,
        workerDisplayId: subData.workerDisplayId,
        proof_text: subData.proofText,
        proof_screenshot_url: subData.proofScreenshotUrl,
        status: 'pending',
      });

      const localJobs = getLocalJobs();
      const localJob = localJobs.find((j) => j.id === subData.jobId);
      const jobTitle = localJob?.title || 'Micro-Job';
      const jobOwnerId = localJob?.owner_id || localJob?.employer_id;

      saveLocalNotification(subData.workerId, {
        title: 'টাস্ক সাবমিশন সফল হয়েছে! ⏳',
        message: `আপনার জব "${jobTitle}"-এর কাজের প্রমাণপত্র সফলভাবে জমা হয়েছে। নিয়োগকর্তা যাচাই করে অনুমোদন দিলে ব্যালেন্স জমা হবে।`,
        type: 'submission',
      });

      if (jobOwnerId && jobOwnerId !== subData.workerId) {
        saveLocalNotification(jobOwnerId, {
          title: 'নতুন টাস্ক সাবমিশন! 📋',
          message: `আপনার জব "${jobTitle}"-এ একজন কর্মী কাজের প্রমাণপত্র জমা দিয়েছেন। My Jobs থেকে পর্যালোচনা করুন।`,
          type: 'submission',
        });
      }

      queueEmailNotification({
        subject: `[IncomeZone] New Task Proof Submitted: ${jobTitle}`,
        message: `A worker has submitted proof for a job on IncomeZone.\n\nJob Title: ${jobTitle}\nJob ID: ${subData.jobId}\nWorker ID: ${subData.workerId}\nProof Notes: ${subData.proofText}\nSubmitted At: ${new Date().toLocaleString()}\n\nPlease review in Admin Panel or Employer My Jobs.`,
        type: 'task_submission',
      });

      return newSub.id;
    }
    throw err;
  }
}

export async function submitJobProof(
  jobId: string, 
  workerId: string, 
  proofText: string, 
  proofScreenshotUrl?: string,
  proofScreenshotUrls?: string[],
  workerDisplayId?: string | number
): Promise<string> {
  return submitJob({ 
    jobId, 
    workerId, 
    workerDisplayId,
    proofText, 
    proofScreenshotUrl: proofScreenshotUrl || (proofScreenshotUrls && proofScreenshotUrls[0]), 
    proofScreenshotUrls 
  });
}

/**
 * Employer approves a worker's submission:
 * Marks submission approved and adds reward to worker's earning balance.
 */
export async function approveSubmission(submissionId: string, jobId: string, workerId: string): Promise<void> {
  // 1. Determine reward based on job price
  let reward = 0;
  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('price_per_task')
      .eq('id', jobId)
      .maybeSingle();

    if (job?.price_per_task) {
      reward = Number(job.price_per_task);
    }
  } catch {}

  if (!reward || reward <= 0) {
    const localJob = getLocalJobs().find((j) => j.id === jobId);
    reward = Number(localJob?.price_per_task || 0.25);
  }

  // 2. Fetch current submission and mark submission as approved in Postgres
  const { data: currentSub, error: fetchSubErr } = await supabase
    .from('submissions')
    .select('id, status, proof_screenshot_url, worker_id')
    .eq('id', submissionId)
    .maybeSingle();

  if (fetchSubErr && isTableMissingError(fetchSubErr)) {
    updateLocalSubmission(submissionId, { status: 'approved', reviewed_at: new Date().toISOString() }, jobId, workerId);
  } else {
    if (fetchSubErr) {
      throw new Error(`সাবমিশন তথ্য লোড করা যায়নি: ${fetchSubErr.message}`);
    }
    if (!currentSub) {
      throw new Error('এই সাবমিশনটি ডাটাবেজে পাওয়া যায়নি।');
    }
    if (currentSub.status && currentSub.status !== 'pending') {
      throw new Error('এই সাবমিশনটি ইতিমধ্যে অ্যাপ্রুভ বা রিজেক্ট করা হয়ে গেছে!');
    }

    const { data: updatedSub, error: updateSubErr } = await supabase
      .from('submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', submissionId)
      .select('id, status')
      .maybeSingle();

    if (updateSubErr) {
      if (isTableMissingError(updateSubErr)) {
        updateLocalSubmission(submissionId, { status: 'approved', reviewed_at: new Date().toISOString() }, jobId, workerId);
      } else {
        throw new Error(`ডাটাবেজে সাবমিশন অ্যাপ্রুভ করা যায়নি: ${updateSubErr.message}`);
      }
    } else if (!updatedSub || updatedSub.status !== 'approved') {
      throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে স্ট্যাটাস আপডেট হয়নি। অনুগ্রহ করে প্রদত্ত Supabase SQL রান করুন।');
    }

    if (currentSub.proof_screenshot_url) {
      let urls: string[] = [];
      try {
        urls = JSON.parse(currentSub.proof_screenshot_url);
      } catch {
        urls = [currentSub.proof_screenshot_url];
      }

      const filePaths = (Array.isArray(urls) ? urls : [urls])
        .map((url: string) => {
          const parts = String(url || '').split('/uploads/');
          return parts.length > 1 ? parts[1] : null;
        })
        .filter(Boolean);

      if (filePaths.length > 0) {
        try {
          await supabase.storage.from('uploads').remove(filePaths as string[]);
        } catch {}
      }
    }

    updateLocalSubmission(submissionId, { status: 'approved', reviewed_at: new Date().toISOString() }, jobId, workerId);
  }

  // 3. Credit worker's earning balance reliably
  let currentEarnings = 0;
  const { data: worker, error: workerFetchErr } = await supabase
    .from('users')
    .select('earning_balance')
    .eq('id', workerId)
    .maybeSingle();

  if (worker && !workerFetchErr) {
    currentEarnings = Number(worker.earning_balance || 0);
  } else {
    const localWorker = getLocalUser(workerId);
    currentEarnings = Number(localWorker?.earning_balance || 0);
  }

  const newEarnings = Number((currentEarnings + reward).toFixed(2));

  // Update Supabase worker balance if worker record exists
  if (worker) {
    const { error: balUpdateErr } = await supabase
      .from('users')
      .update({ earning_balance: newEarnings })
      .eq('id', workerId);

    if (balUpdateErr && !isTableMissingError(balUpdateErr)) {
      console.warn('Worker earning balance DB update warning:', balUpdateErr);
    }
  }

  // Update local store
  saveLocalUser(workerId, { earning_balance: newEarnings });

  // Update stored session if worker is on this device
  try {
    const rawSession = localStorage.getItem('iz_auth_session');
    if (rawSession) {
      const sess = JSON.parse(rawSession);
      if (sess?.user?.uid === workerId || sess?.profile?.id === workerId) {
        sess.user.earningBalance = newEarnings;
        sess.profile.earningBalance = newEarnings;
        localStorage.setItem('iz_auth_session', JSON.stringify(sess));
      }
    }
  } catch {}

  // Dispatch balance update & user notification
  saveLocalNotification(workerId, {
    title: 'টাস্ক অ্যাপ্রুভড! 🏆',
    message: `আপনার সাবমিট করা জবের কাজটির প্রমাণপত্র সফলভাবে অ্যাপ্রুভ করা হয়েছে এবং $${reward.toFixed(2)} (৳${Math.round(reward * 100)}) আর্নিং ব্যালেন্স ওয়ালেটে জমা হয়েছে।`,
    type: 'submission',
  });

  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('iz_balance_updated', {
      detail: { userId: workerId, earningBalance: newEarnings }
    }));
    window.dispatchEvent(new CustomEvent('submission_updated', { detail: { jobId, submissionId, status: 'approved' } }));
    window.dispatchEvent(new CustomEvent('iz_users_updated'));
  }, 0);
}

/**
 * Employer rejects a submission:
 * Marks submission rejected and reopens a slot on the job.
 */
export async function rejectSubmission(submissionId: string, jobId: string, reason?: string): Promise<void> {
  try {
    const { data: currentSub, error: fetchErr } = await supabase
      .from('submissions')
      .select('id, status, proof_screenshot_url, worker_id')
      .eq('id', submissionId)
      .maybeSingle();

    if (fetchErr && isTableMissingError(fetchErr)) {
      updateLocalSubmission(submissionId, { status: 'rejected', rejection_reason: reason });
      const localJob = getLocalJobs().find((j) => j.id === jobId);
      if (localJob) {
        const newOccupied = Math.max(0, localJob.occupied_slots - 1);
        updateLocalJob(jobId, { occupied_slots: newOccupied, status: 'active' });
      }
      return;
    }

    if (fetchErr) {
      throw new Error(`সাবমিশন তথ্য পাওয়া যায়নি: ${fetchErr.message}`);
    }
    if (!currentSub) {
      throw new Error('এই সাবমিশনটি ডাটাবেজে পাওয়া যায়নি।');
    }
    if (currentSub.status && currentSub.status !== 'pending') {
      throw new Error('এই সাবমিশনটি ইতিমধ্যে অ্যাপ্রুভ বা রিজেক্ট করা হয়ে গেছে!');
    }

    const workerId = currentSub.worker_id;

    const { data: updatedSub, error: subError } = await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        ...(reason ? { rejection_reason: reason } : {}),
      })
      .eq('id', submissionId)
      .select('id, status')
      .maybeSingle();

    if (subError && isTableMissingError(subError)) {
      updateLocalSubmission(submissionId, { status: 'rejected', rejection_reason: reason });
      const localJob = getLocalJobs().find((j) => j.id === jobId);
      if (localJob) {
        const newOccupied = Math.max(0, localJob.occupied_slots - 1);
        updateLocalJob(jobId, { occupied_slots: newOccupied, status: 'active' });
      }
      return;
    }

    if (subError) {
      throw new Error(`ডাটাবেজে সাবমিশন রিজেক্ট সেভ হয়নি: ${subError.message}`);
    }

    if (!updatedSub || updatedSub.status !== 'rejected') {
      throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে রিজেক্ট সেভ হয়নি। অনুগ্রহ করে প্রদত্ত Supabase SQL রান করুন।');
    }

    if (currentSub.proof_screenshot_url) {
      let urls: string[] = [];
      try {
        urls = JSON.parse(currentSub.proof_screenshot_url);
      } catch {
        urls = [currentSub.proof_screenshot_url];
      }

      const filePaths = (Array.isArray(urls) ? urls : [urls])
        .map((url: string) => {
          const parts = String(url || '').split('/uploads/');
          return parts.length > 1 ? parts[1] : null;
        })
        .filter(Boolean);

      if (filePaths.length > 0) {
        try {
          await supabase.storage.from('uploads').remove(filePaths as string[]);
        } catch {}
      }
    }

    updateLocalSubmission(submissionId, {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      ...(reason ? { rejection_reason: reason } : {}),
    }, jobId);

    if (workerId) {
      saveLocalNotification(workerId, {
        title: 'টাস্ক রিজেক্টেড ⚠️',
        message: `আপনার সাবমিট করা কাজটির প্রমাণপত্র গ্রহণযোগ্য হয়নি। ${reason ? `কারণ: ${reason}` : ''}`,
        type: 'submission',
      });
    }

    // Reopen 1 slot on the job safely (using maybeSingle in case job was deleted)
    if (jobId) {
      const { data: job } = await supabase
        .from('jobs')
        .select('occupied_slots, status')
        .eq('id', jobId)
        .maybeSingle();

      if (job) {
        const currentOccupied = Number(job.occupied_slots || 0);
        const newOccupied = Math.max(0, currentOccupied - 1);
        await supabase
          .from('jobs')
          .update({
            occupied_slots: newOccupied,
            status: job.status === 'completed' ? 'active' : job.status,
          })
          .eq('id', jobId);
      }
    }

    window.dispatchEvent(new CustomEvent('submission_updated', { detail: { jobId, submissionId, status: 'rejected' } }));
    window.dispatchEvent(new CustomEvent('iz_jobs_updated'));
    window.dispatchEvent(new CustomEvent('iz_users_updated'));
  } catch (err) {
    if (isTableMissingError(err)) {
      updateLocalSubmission(submissionId, { status: 'rejected', rejection_reason: reason });
      return;
    }
    throw err;
  }
}

/**
 * Admin approves a newly posted job -> sets status to 'active'.
 */
export async function adminApproveJob(jobId: string): Promise<void> {
  try {
    const { data: job, error: fetchErr } = await supabase
      .from('jobs')
      .select('owner_id, employer_id, title')
      .eq('id', jobId)
      .maybeSingle();

    if (fetchErr && isTableMissingError(fetchErr)) {
      const localJob = updateLocalJob(jobId, { status: 'active' });
      if (localJob?.owner_id) {
        saveLocalNotification(localJob.owner_id, {
          title: 'জব ক্যাম্পেইন লাইভ! 🚀',
          message: `আপনার পোস্ট করা নতুন মিশন "${localJob.title || 'Job'}" অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং সরাসরি লাইভ করা হয়েছে।`,
          type: 'announcement',
        });
      }
      window.dispatchEvent(new CustomEvent('iz_jobs_updated'));
      return;
    }

    const ownerId = job?.owner_id || job?.employer_id;

    const { data: updatedJob, error } = await supabase
      .from('jobs')
      .update({ status: 'active' })
      .eq('id', jobId)
      .select('id, status')
      .maybeSingle();

    if (error && isTableMissingError(error)) {
      const localJob = updateLocalJob(jobId, { status: 'active' });
      if (localJob?.owner_id) {
        saveLocalNotification(localJob.owner_id, {
          title: 'জব ক্যাম্পেইন লাইভ! 🚀',
          message: `আপনার পোস্ট করা নতুন মিশন "${localJob.title || 'Job'}" অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং সরাসরি লাইভ করা হয়েছে।`,
          type: 'announcement',
        });
      }
      window.dispatchEvent(new CustomEvent('iz_jobs_updated'));
      return;
    }

    if (error) {
      throw new Error(`জব অ্যাপ্রুভ করা যায়নি: ${error.message}`);
    }

    if (!updatedJob || updatedJob.status !== 'active') {
      throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে জবটি অ্যাপ্রুভ হয়নি। অনুগ্রহ করে প্রদত্ত Supabase SQL রান করুন।');
    }

    updateLocalJob(jobId, { status: 'active' });

    if (ownerId) {
      saveLocalNotification(ownerId, {
        title: 'জব ক্যাম্পেইন লাইভ! 🚀',
        message: `আপনার পোস্ট করা নতুন মিশন "${job?.title || 'Job'}" অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং সরাসরি লাইভ করা হয়েছে।`,
        type: 'announcement',
      });
    }

    window.dispatchEvent(new CustomEvent('iz_jobs_updated'));
    window.dispatchEvent(new CustomEvent('iz_users_updated'));
  } catch (err) {
    if (isTableMissingError(err)) {
      updateLocalJob(jobId, { status: 'active' });
      return;
    }
    throw err;
  }
}

/**
 * Admin rejects a pending/active job:
 * Sets status to 'rejected', stores rejection reason, and refunds remaining budget to employer deposit balance.
 */
export async function adminRejectJob(jobId: string, reason = 'Violates platform guidelines'): Promise<void> {
  try {
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError && isTableMissingError(jobError)) {
      const localJob = updateLocalJob(jobId, { status: 'rejected', rejection_reason: reason });
      if (localJob) {
        const owner = getLocalUser(localJob.owner_id);
        if (owner) {
          const refund = localJob.price_per_task * (localJob.total_slots - localJob.occupied_slots);
          saveLocalUser(localJob.owner_id, { deposit_balance: owner.deposit_balance + refund });
          saveLocalNotification(localJob.owner_id, {
            title: 'জব পোস্ট বাতিল ও রিফান্ড ⚠️',
            message: `আপনার পোস্ট করা মিশনটি বাতিল করা হয়েছে। কারণ: ${reason}। অব্যবহৃত $${refund.toFixed(2)} ডিপোজিট ব্যালেন্সে ফেরত দেওয়া হয়েছে।`,
            type: 'announcement',
          });
        }
      }
      window.dispatchEvent(new CustomEvent('iz_jobs_updated'));
      return;
    }

    if (jobError) {
      throw new Error(`জব তথ্য পাওয়া যায়নি: ${jobError.message}`);
    }
    if (!job) {
      throw new Error('এই জবটি ডাটাবেজে পাওয়া যায়নি।');
    }

    const price = Number(job.price_per_task || 0);
    const totalSlots = Number(job.total_slots || 0);
    const occupiedSlots = Number(job.occupied_slots || 0);
    const ownerId = job.owner_id || job.employer_id;
    const slotsToRefund = job.status === 'pending' ? totalSlots : (totalSlots - occupiedSlots);
    const refundAmount = Number((price * Math.max(0, slotsToRefund)).toFixed(2));

    const { data: updatedJob, error: updateErr } = await supabase
      .from('jobs')
      .update({
        status: 'rejected',
        rejection_reason: reason,
      })
      .eq('id', jobId)
      .select('id, status')
      .maybeSingle();

    if (updateErr) {
      throw new Error(`ডাটাবেজে জব রিজেক্ট সেভ হয়নি: ${updateErr.message}`);
    }

    if (!updatedJob || updatedJob.status !== 'rejected') {
      throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে জব রিজেক্ট হয়নি। অনুগ্রহ করে প্রদত্ত Supabase SQL রান করুন।');
    }

    updateLocalJob(jobId, { status: 'rejected', rejection_reason: reason });

    if (refundAmount > 0 && ownerId) {
      const { data: owner } = await supabase
        .from('users')
        .select('deposit_balance')
        .eq('id', ownerId)
        .maybeSingle();

      if (owner) {
        const currentDeposit = Number(owner.deposit_balance || 0);
        const newDeposit = Number((currentDeposit + refundAmount).toFixed(2));
        const { error: refundErr } = await supabase
          .from('users')
          .update({ deposit_balance: newDeposit })
          .eq('id', ownerId);

        if (!refundErr) {
          saveLocalUser(ownerId, { deposit_balance: newDeposit });
          window.dispatchEvent(new CustomEvent('iz_balance_updated', {
            detail: { userId: ownerId, depositBalance: newDeposit }
          }));
        }
      }

      saveLocalNotification(ownerId, {
        title: 'জব পোস্ট বাতিল ও রিফান্ড ⚠️',
        message: `আপনার পোস্ট করা মিশন "${job.title || 'Job'}" বাতিল করা হয়েছে। কারণ: ${reason}। অব্যবহৃত $${refundAmount.toFixed(2)} ডিপোজিট ব্যালেন্সে ফেরত দেওয়া হয়েছে।`,
        type: 'announcement',
      });
    }

    window.dispatchEvent(new CustomEvent('iz_jobs_updated'));
    window.dispatchEvent(new CustomEvent('iz_users_updated'));
  } catch (err) {
    if (isTableMissingError(err)) {
      updateLocalJob(jobId, { status: 'rejected', rejection_reason: reason });
      return;
    }
    throw err;
  }
}

/**
 * User requests a deposit.
 */
export async function createDepositRequest(userId: string, amount: number, method: string, senderNumber: string, transactionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('deposit_requests')
      .insert({
        user_id: userId,
        amount: Number(amount),
        method,
        sender_number: senderNumber,
        transaction_id: transactionId,
        status: 'pending',
      });

    if (error) {
      if (isTableMissingError(error)) {
        saveLocalDeposit({
          user_id: userId,
          amount: Number(amount),
          method,
          sender_number: senderNumber,
          transaction_id: transactionId,
          status: 'pending',
        });
        return;
      }
      throw new Error(`Failed to create deposit request: ${error.message}`);
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      saveLocalDeposit({
        user_id: userId,
        amount: Number(amount),
        method,
        sender_number: senderNumber,
        transaction_id: transactionId,
        status: 'pending',
      });
      return;
    }
    throw err;
  }
}

/**
 * User requests a withdrawal from earning balance.
 */
export async function createWithdrawRequest(userId: string, amount: number, method: string, accountNumber: string): Promise<void> {
  const parsedAmount = Number(amount);

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('earning_balance')
      .eq('id', userId)
      .single();

    if (userError && isTableMissingError(userError)) {
      const localUser = getLocalUser(userId);
      const currentEarning = Number(localUser?.earning_balance || 0);
      if (currentEarning < parsedAmount) {
        throw new Error(`Insufficient earning balance. Available: $${currentEarning.toFixed(2)}`);
      }
      saveLocalUser(userId, { earning_balance: Math.max(0, currentEarning - parsedAmount) });
      saveLocalWithdrawal({
        user_id: userId,
        amount: parsedAmount,
        method,
        account_number: accountNumber,
        status: 'pending',
      });
      return;
    }

    const currentEarning = Number(user?.earning_balance || 0);
    if (currentEarning < parsedAmount) {
      throw new Error(`Insufficient earning balance. Available: $${currentEarning.toFixed(2)}`);
    }

    await supabase
      .from('users')
      .update({ earning_balance: currentEarning - parsedAmount })
      .eq('id', userId);

    const { error: reqError } = await supabase
      .from('withdraw_requests')
      .insert({
        user_id: userId,
        amount: parsedAmount,
        method,
        account_number: accountNumber,
        status: 'pending',
      });

    if (reqError) {
      if (isTableMissingError(reqError)) {
        saveLocalWithdrawal({
          user_id: userId,
          amount: parsedAmount,
          method,
          account_number: accountNumber,
          status: 'pending',
        });
        return;
      }
      // Rollback
      await supabase
        .from('users')
        .update({ earning_balance: currentEarning })
        .eq('id', userId);
      throw new Error(`Failed to submit withdrawal: ${reqError.message}`);
    }
  } catch (err: any) {
    if (isTableMissingError(err)) {
      saveLocalWithdrawal({
        user_id: userId,
        amount: parsedAmount,
        method,
        account_number: accountNumber,
        status: 'pending',
      });
      return;
    }
    throw err;
  }
}

/**
 * Permanently deletes a job from Supabase and local fallback store.
 */
export async function deleteJob(jobId: string, _userId?: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (error && !isTableMissingError(error)) {
      throw new Error(`ডাটাবেজ থেকে জব ডিলিট করা যায়নি: ${error.message}`);
    }

    const local = getLocalJobs().filter((j: any) => j.id !== jobId);
    localStorage.setItem('iz_fallback_jobs', JSON.stringify(local));

    const localSubs = getLocalSubmissions().filter((s: any) => s.job_id !== jobId);
    localStorage.setItem('iz_fallback_submissions', JSON.stringify(localSubs));

    window.dispatchEvent(new CustomEvent('iz_jobs_updated'));
    window.dispatchEvent(new CustomEvent('iz_users_updated'));
  } catch (err: any) {
    if (isTableMissingError(err)) {
      const local = getLocalJobs().filter((j: any) => j.id !== jobId);
      localStorage.setItem('iz_fallback_jobs', JSON.stringify(local));
      return;
    }
    throw err;
  }
}
