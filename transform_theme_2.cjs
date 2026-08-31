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

  // Fix duplicated classes and bad hover states
  content = content.replace(/border border-purple-500\/20 border border-purple-500\/20/g, 'border border-purple-500/20');
  content = content.replace(/border border-gray-100/g, 'border-purple-500/20');
  content = content.replace(/bg-transparent text-white/g, 'bg-transparent'); // Undo that
  content = content.replace(/group-hover:text-purple-700/g, 'group-hover:text-amber-400');
  content = content.replace(/hover:text-purple-600/g, 'hover:text-amber-400');
  content = content.replace(/text-indigo-600/g, 'text-amber-400');
  content = content.replace(/text-purple-600/g, 'text-amber-400');
  content = content.replace(/text-purple-500/g, 'text-amber-400');
  content = content.replace(/bg-purple-100/g, 'bg-purple-900/30');
  content = content.replace(/bg-indigo-100/g, 'bg-purple-900/30');
  content = content.replace(/bg-amber-100/g, 'bg-amber-500/10');
  content = content.replace(/bg-emerald-100/g, 'bg-emerald-500/10');
  content = content.replace(/bg-sky-100/g, 'bg-sky-500/10');
  content = content.replace(/bg-blue-100/g, 'bg-blue-500/10');
  content = content.replace(/bg-purple-50/g, 'bg-purple-900/20');
  content = content.replace(/bg-indigo-50/g, 'bg-purple-900/20');
  content = content.replace(/bg-emerald-50/g, 'bg-emerald-900/20');
  content = content.replace(/bg-amber-50/g, 'bg-amber-900/20');
  content = content.replace(/bg-sky-50/g, 'bg-sky-900/20');
  content = content.replace(/bg-blue-50/g, 'bg-blue-900/20');
  content = content.replace(/bg-red-50/g, 'bg-red-900/20');
  content = content.replace(/bg-rose-50/g, 'bg-rose-900/20');
  content = content.replace(/bg-red-100/g, 'bg-red-500/10');
  content = content.replace(/bg-rose-100/g, 'bg-rose-500/10');
  content = content.replace(/text-slate-900/g, 'text-white');
  content = content.replace(/hover:bg-slate-50/g, 'hover:bg-purple-900/20');
  content = content.replace(/bg-white\/90/g, 'bg-[#130b2c]/60');
  content = content.replace(/bg-white/g, 'bg-[#130b2c]/60');

  // Input fixes
  content = content.replace(/bg-\[\#180d38\]\/50/g, 'bg-[#180d38]/80 text-white placeholder-purple-300/40');

  fs.writeFileSync(file, content, 'utf8');
});

console.log("Done");
