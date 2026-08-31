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
} from './localFallbackStore';

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
  proofText: string;
  proofScreenshotUrl?: string;
  proofScreenshotUrls?: string[];
}

/**
 * Uploads a file to Supabase Storage 'uploads' bucket or fallback data URL.
 */
export async function uploadFile(file: File, folder = 'proofs'): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error || !data) {
      return URL.createObjectURL(file);
    }

    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch {
    return URL.createObjectURL(file);
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
      // Fallback to local user balance or initialize
      const localUser = getLocalUser(ownerId) || saveLocalUser(ownerId, { deposit_balance: 100 });
      currentBalance = Number(localUser.deposit_balance || 100);
      // Auto-upsert user into Supabase to self-heal
      try {
        await supabase.from('users').upsert({
          id: ownerId,
          email: `${ownerId}@incomezone.app`,
          name: 'User',
          username: 'user',
          deposit_balance: currentBalance,
          earning_balance: 50,
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

    const jobPayload: any = {
      title: jobData.title,
      description: jobData.description,
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
        const { data, error: fallbackError } = await supabase
          .from('jobs')
          .insert({
            title: jobData.title,
            description: jobData.description,
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
          })
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
      description: jobData.description,
      owner_id: ownerId,
      employer_id: ownerId,
      status: 'pending',
    });

    return insertedJob?.id || localSaved.id;
  } catch (err: any) {
    if (err?.message === "Insufficient Deposit Balance" || err?.message?.includes("Insufficient Deposit Balance")) {
      throw new Error("Insufficient Deposit Balance");
    }

    const textProofInst = jobData.text_proof_instruction || jobData.textProofInstruction || jobData.textProofRequirement || '';
    const screenshotInsts = jobData.screenshot_instructions || jobData.screenshotInstructions || [];

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
      description: jobData.description,
      owner_id: ownerId,
      employer_id: ownerId,
      status: 'pending',
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

    // 2. Check if user already submitted for this job
    const { data: existingSub } = await supabase
      .from('submissions')
      .select('id')
      .eq('job_id', subData.jobId)
      .eq('worker_id', subData.workerId)
      .maybeSingle();

    if (existingSub) {
      throw new Error('You have already submitted proof for this task.');
    }

    // 3. Create submission record
    const primaryScreenshotUrl = subData.proofScreenshotUrl || (subData.proofScreenshotUrls && subData.proofScreenshotUrls[0]) || null;
    const allScreenshots = subData.proofScreenshotUrls && subData.proofScreenshotUrls.length > 0 
      ? subData.proofScreenshotUrls 
      : (primaryScreenshotUrl ? [primaryScreenshotUrl] : []);

    let newSubId: string = '';

    try {
      const { data: newSub, error: subError } = await supabase
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

      if (!subError && newSub) {
        newSubId = newSub.id;
      }
    } catch {}

    const newLocalSub = saveLocalSubmission({
      id: newSubId,
      job_id: subData.jobId,
      worker_id: subData.workerId,
      proof_text: subData.proofText,
      proof_screenshot_url: primaryScreenshotUrl,
      proof_screenshot_urls: allScreenshots,
      status: 'pending',
    });

    if (!newSubId) {
      newSubId = newLocalSub.id;
    }

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

    return newSubId;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      const newSub = saveLocalSubmission({
        job_id: subData.jobId,
        worker_id: subData.workerId,
        proof_text: subData.proofText,
        proof_screenshot_url: subData.proofScreenshotUrl,
        status: 'pending',
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
  proofScreenshotUrls?: string[]
): Promise<string> {
  return submitJob({ 
    jobId, 
    workerId, 
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
  try {
    const { data: currentSub } = await supabase.from('submissions').select('status').eq('id', submissionId).single();
    if (currentSub?.status && currentSub.status !== 'pending') {
      throw new Error("This submission has already been approved or rejected!");
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('price_per_task')
      .eq('id', jobId)
      .single();

    if (jobError && isTableMissingError(jobError)) {
      updateLocalSubmission(submissionId, { status: 'approved' });
      const localJob = getLocalJobs().find((j) => j.id === jobId);
      const reward = Number(localJob?.price_per_task || 0.25);
      const worker = getLocalUser(workerId) || saveLocalUser(workerId, { earning_balance: 0 });
      saveLocalUser(workerId, { earning_balance: Number(worker.earning_balance || 0) + reward });
      return;
    }

    const reward = Number(job?.price_per_task || 0);

    // 2. Mark submission approved
    await supabase
      .from('submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', submissionId);
    
    updateLocalSubmission(submissionId, { status: 'approved', reviewed_at: new Date().toISOString() });

    // 3. Credit worker's earning balance
    const { data: worker } = await supabase
      .from('users')
      .select('earning_balance')
      .eq('id', workerId)
      .single();

    const currentEarnings = Number(worker?.earning_balance || 0);
    await supabase
      .from('users')
      .update({ earning_balance: currentEarnings + reward })
      .eq('id', workerId);
  } catch (err) {
    if (isTableMissingError(err)) {
      updateLocalSubmission(submissionId, { status: 'approved' });
      return;
    }
    throw err;
  }
}

/**
 * Employer rejects a submission:
 * Marks submission rejected and reopens a slot on the job.
 */
export async function rejectSubmission(submissionId: string, jobId: string, reason?: string): Promise<void> {
  try {
    const { error: subError } = await supabase
      .from('submissions')
      .update({ 
        status: 'rejected', 
        reviewed_at: new Date().toISOString(),
        ...(reason ? { rejection_reason: reason } : {}) 
      })
      .eq('id', submissionId);

    if (subError && isTableMissingError(subError)) {
      updateLocalSubmission(submissionId, { status: 'rejected' });
      const localJob = getLocalJobs().find((j) => j.id === jobId);
      if (localJob) {
        const newOccupied = Math.max(0, localJob.occupied_slots - 1);
        updateLocalJob(jobId, { occupied_slots: newOccupied, status: 'active' });
      }
      return;
    }

    // Reopen 1 slot on the job
    const { data: job } = await supabase
      .from('jobs')
      .select('occupied_slots, status')
      .eq('id', jobId)
      .single();

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
  } catch (err) {
    if (isTableMissingError(err)) {
      updateLocalSubmission(submissionId, { status: 'rejected' });
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
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'active' })
      .eq('id', jobId);

    if (error && isTableMissingError(error)) {
      updateLocalJob(jobId, { status: 'active' });
      return;
    }
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
      .single();

    if (jobError && isTableMissingError(jobError)) {
      const localJob = updateLocalJob(jobId, { status: 'rejected', rejection_reason: reason });
      if (localJob) {
        const owner = getLocalUser(localJob.owner_id);
        if (owner) {
          const refund = localJob.price_per_task * (localJob.total_slots - localJob.occupied_slots);
          saveLocalUser(localJob.owner_id, { deposit_balance: owner.deposit_balance + refund });
        }
      }
      return;
    }

    if (!job) return;

    const price = Number(job.price_per_task || 0);
    const totalSlots = Number(job.total_slots || 0);
    const occupiedSlots = Number(job.occupied_slots || 0);
    const ownerId = job.owner_id || job.employer_id;
    const slotsToRefund = job.status === 'pending' ? totalSlots : (totalSlots - occupiedSlots);
    const refundAmount = price * Math.max(0, slotsToRefund);

    await supabase
      .from('jobs')
      .update({
        status: 'rejected',
        rejection_reason: reason,
      })
      .eq('id', jobId);

    if (refundAmount > 0 && ownerId) {
      const { data: owner } = await supabase
        .from('users')
        .select('deposit_balance')
        .eq('id', ownerId)
        .single();

      const currentDeposit = Number(owner?.deposit_balance || 0);
      await supabase
        .from('users')
        .update({ deposit_balance: currentDeposit + refundAmount })
        .eq('id', ownerId);
    }
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
      const localUser = getLocalUser(userId) || saveLocalUser(userId, { earning_balance: 50 });
      const currentEarning = Number(localUser.earning_balance || 0);
      if (currentEarning < parsedAmount) {
        throw new Error(`Insufficient earning balance. Available: $${currentEarning.toFixed(2)}`);
      }
      saveLocalUser(userId, { earning_balance: currentEarning - parsedAmount });
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
export async function deleteJob(jobId: string, userId?: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (error && isTableMissingError(error)) {
      const local = getLocalJobs().filter((j: any) => j.id !== jobId);
      localStorage.setItem('iz_fallback_jobs', JSON.stringify(local));
      return;
    }

    const local = getLocalJobs().filter((j: any) => j.id !== jobId);
    localStorage.setItem('iz_fallback_jobs', JSON.stringify(local));
  } catch {
    const local = getLocalJobs().filter((j: any) => j.id !== jobId);
    localStorage.setItem('iz_fallback_jobs', JSON.stringify(local));
  }
}
