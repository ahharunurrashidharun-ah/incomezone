const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const newRoutes = `
          <Route 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Navigate to="/jobs" replace />} />
            <Route path="/dashboard/find-job" element={<Navigate to="/jobs" replace />} />
            <Route path="/jobs" element={<FindJobPage />} />
            <Route path="/post-job" element={<PostJobPage />} />
            <Route path="/my-jobs" element={<MyJobsPage />} />
            <Route path="/submitted-jobs" element={<SubmittedJobPage />} />
            <Route path="/post-ad" element={<PostAdPage />} />
            <Route path="/posted-ads" element={<PostedAdPage />} />
            <Route path="/deposit" element={<DepositPage />} />
            <Route path="/withdraw" element={<WithdrawPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
`;

content = content.replace(/<Route \s*path="\/dashboard"[\s\S]*?<\/Route>/, newRoutes.trim());

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log("Done App.tsx");
