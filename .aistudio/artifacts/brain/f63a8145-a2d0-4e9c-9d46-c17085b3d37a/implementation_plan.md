# Job Categories Update Plan

Updating the micro-job posting and job searching categories across the platform to include the complete 30-category options provided in the reference image screenshot.

## Confirmed Scope & Category List

The following 30 categories will be integrated into the job posting and filtering system:

1. **Ads Click, SEO, Visit, Search, Engage**
2. **Sign Up**
3. **Mobile Application**
4. **Forums**
5. **Computer Programs**
6. **Comment on other blogs**
7. **Survey**
8. **Identity Verification**
9. **Facebook**
10. **Twitter**
11. **Instagram**
12. **Youtube**
13. **Discord**
14. **Reddit**
15. **Telegram**
16. **Medium**
17. **Whats-App**
18. **Tiktok**
19. **Linkedin**
20. **Gmail Account**
21. **Review**
22. **Data Entry**
23. **Promotion**
24. **Airdrop/Offer Join**
25. **OTP Verification**
26. **Answers**
27. **Toffee**
28. **Snapchat**
29. **Quora**
30. **Other**

---

## 1. Overview & Core Concept

- **Goal**: Expand the job creation options on `PostJobPage` and job discovery/filtering on `FindJobPage` with all 30 requested micro-task categories.
- **User Impact**: Employers can categorize micro-tasks with precision (e.g., Airdrop, OTP Verification, Data Entry, Mobile App, Toffee, Quora), and workers can easily filter tasks matching their skillsets.

---

## 2. User Experience & Visual Design

- **Post Job Page (`/post-job`)**:
  - Update the Category dropdown selector to present the 30 structured options cleanly categorized with dark/light mode styled select styling.
  - Set a sensible default category (e.g. `Ads Click, SEO, Visit, Search, Engage` or `Facebook`).

- **Find Job Page (`/jobs`)**:
  - Update the Category filter chips/dropdown so workers can filter available missions by any of these 30 categories.
  - Maintain the `ALL` quick-filter option at the beginning.

---

## 3. Technical Architecture & Component Changes

```
┌────────────────────────────────────────────────────────┐
│               Job Categories Data Model                │
│                                                        │
│  [CATEGORIES List (30 Items)]                          │
│     │                                                  │
│     ├──────► PostJobPage (Job Creation Select)        │
│     ├──────► FindJobPage (Job Filtering & Search)     │
│     └──────► AdminJobsPage (Admin Filter & Display)    │
└────────────────────────────────────────────────────────┘
```

### Proposed Code Adjustments:
1. **Category Constant (`src/constants/categories.ts` or inline in `PostJobPage.tsx` & `FindJobPage.tsx`)**:
   - Define a central, shared `JOB_CATEGORIES` array containing all 30 category strings.
2. **`PostJobPage.tsx` Integration**:
   - Import and populate the category dropdown with `JOB_CATEGORIES`.
3. **`FindJobPage.tsx` Integration**:
   - Import and populate the category filter bar with `JOB_CATEGORIES`.

---

## Verification & Testing
- Compile and lint the applet with `compile_applet`.
- Verify category options render cleanly in both light and dark themes without breaking any layout flow.
