const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
  let files = fs.readdirSync(dirPath)
  arrayOfFiles = arrayOfFiles || []
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      if (file.endsWith('.tsx')) {
        arrayOfFiles.push(path.join(dirPath, "/", file))
      }
    }
  })
  return arrayOfFiles
}

const files = getAllFiles('src/pages');
const excludeFiles = [
  'src/pages/LandingPage.tsx',
  'src/pages/DashboardLayout.tsx',
  'src/pages/admin/AdminLayout.tsx',
  'src/pages/LoginPage.tsx',
  'src/pages/SignUpPage.tsx',
];

const targetFiles = files.filter(f => !excludeFiles.includes(f));

targetFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Regex to remove duplicated class names (simple approximation)
  content = content.replace(/border border-purple-500\/20 border-purple-500\/20/g, 'border border-purple-500/20');
  content = content.replace(/border border-purple-500\/20 border border-purple-500\/20/g, 'border border-purple-500/20');
  content = content.replace(/border border-purple-500\/30 border-purple-500\/30/g, 'border border-purple-500/30');
  
  // Make sure tables look good
  content = content.replace(/divide-gray-200/g, 'divide-purple-500/20');
  content = content.replace(/bg-gray-50/g, 'bg-[#180d38]/50');

  // Global background on App / Main?
  // Let's also verify text-slate-XYZ wasn't missed.
  content = content.replace(/text-slate-900/g, 'text-white');
  content = content.replace(/text-slate-800/g, 'text-purple-100');
  content = content.replace(/text-slate-700/g, 'text-purple-200');
  content = content.replace(/text-slate-600/g, 'text-purple-200/80');
  content = content.replace(/text-slate-500/g, 'text-purple-300/60');
  content = content.replace(/text-slate-400/g, 'text-purple-300/40');
  content = content.replace(/text-slate-300/g, 'text-purple-300/40');
  content = content.replace(/text-slate-200/g, 'text-purple-300/20');

  fs.writeFileSync(file, content, 'utf8');
});

console.log("Done");
