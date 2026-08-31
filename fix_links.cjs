const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, regex, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
}

replaceInFile('src/pages/admin/AdminLoginPage.tsx', /\/dashboard\/find-job/g, '/jobs');
replaceInFile('src/pages/SubmittedJobPage.tsx', /\/dashboard\/find-job/g, '/jobs');
replaceInFile('src/pages/PostAdPage.tsx', /\/dashboard\/posted-ad/g, '/posted-ads');
replaceInFile('src/pages/PostJobPage.tsx', /\/dashboard\/find-job/g, '/jobs');
replaceInFile('src/pages/PostedAdPage.tsx', /\/dashboard\/post-ad/g, '/post-ad');

console.log("Done fixing links");
