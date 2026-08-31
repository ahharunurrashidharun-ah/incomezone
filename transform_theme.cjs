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

  // Backgrounds & Containers
  content = content.replace(/bg-slate-50/g, 'bg-transparent');
  content = content.replace(/bg-slate-100/g, 'bg-[#180d38]/50');
  content = content.replace(/bg-slate-900/g, 'bg-[#080412]');
  content = content.replace(/bg-slate-800/g, 'bg-[#130b2c]');
  content = content.replace(/bg-white\/90/g, 'bg-[#130b2c]/60');
  content = content.replace(/bg-white\/80/g, 'bg-[#130b2c]/50');
  content = content.replace(/bg-white/g, 'bg-[#130b2c]/60 backdrop-blur-xl border border-purple-500/20');
  
  // Text colors
  content = content.replace(/text-slate-900/g, 'text-white');
  content = content.replace(/text-slate-800/g, 'text-purple-100');
  content = content.replace(/text-slate-700/g, 'text-purple-200');
  content = content.replace(/text-slate-600/g, 'text-purple-200/80');
  content = content.replace(/text-slate-500/g, 'text-purple-300/60');
  content = content.replace(/text-slate-400/g, 'text-purple-300/40');
  content = content.replace(/text-gray-900/g, 'text-white');
  content = content.replace(/text-gray-800/g, 'text-purple-100');
  content = content.replace(/text-gray-700/g, 'text-purple-200');
  content = content.replace(/text-gray-600/g, 'text-purple-200/80');
  content = content.replace(/text-gray-500/g, 'text-purple-300/60');
  
  // Borders
  content = content.replace(/border-slate-200/g, 'border-purple-500/20');
  content = content.replace(/border-slate-300/g, 'border-purple-500/30');
  content = content.replace(/border-gray-200/g, 'border-purple-500/20');
  content = content.replace(/border-gray-300/g, 'border-purple-500/30');
  content = content.replace(/border-purple-100/g, 'border-purple-500/20');
  content = content.replace(/border-purple-200/g, 'border-purple-500/30');
  
  // Shadows
  content = content.replace(/shadow-sm/g, 'shadow-lg shadow-purple-900/20');
  content = content.replace(/shadow-md/g, 'shadow-xl shadow-purple-900/40');
  
  // Primary buttons (that used indigo/purple)
  content = content.replace(/bg-indigo-600 hover:bg-indigo-700/g, 'bg-[#1a0f3d]/80 border border-amber-400/60 text-purple-100 hover:bg-gradient-to-r hover:from-amber-400 hover:to-yellow-500 hover:text-slate-950');
  content = content.replace(/bg-purple-600 hover:bg-purple-700/g, 'bg-[#1a0f3d]/80 border border-amber-400/60 text-purple-100 hover:bg-gradient-to-r hover:from-amber-400 hover:to-yellow-500 hover:text-slate-950');
  content = content.replace(/bg-indigo-600/g, 'bg-[#1a0f3d]/80 border border-amber-400/60 text-purple-100');
  content = content.replace(/hover:bg-indigo-700/g, 'hover:bg-gradient-to-r hover:from-amber-400 hover:to-yellow-500 hover:text-slate-950');
  
  // Form inputs
  content = content.replace(/focus:ring-indigo-500/g, 'focus:ring-amber-400');
  content = content.replace(/focus:border-indigo-500/g, 'focus:border-amber-400');
  content = content.replace(/focus:ring-purple-500/g, 'focus:ring-amber-400');
  content = content.replace(/focus:border-purple-500/g, 'focus:border-amber-400');
  content = content.replace(/focus:ring-amber-500/g, 'focus:ring-amber-400');

  // Background colors in forms
  content = content.replace(/bg-transparent/g, 'bg-transparent text-white'); // avoid making it white if we accidentally removed the bg

  fs.writeFileSync(file, content, 'utf8');
});

console.log("Done");
