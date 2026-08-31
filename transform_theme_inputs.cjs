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

  // Any textarea or input with border-purple-X, bg-transparent etc.
  content = content.replace(/border-purple-500\/30 rounded-xl shadow-lg shadow-purple-900\/20 focus:ring-amber-400 focus:border-amber-500 bg-transparent/g, 'bg-[#180d38]/80 border border-purple-700/40 text-white placeholder-purple-300/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl');
  content = content.replace(/border border-purple-500\/20 bg-transparent text-white/g, 'bg-[#180d38]/80 border border-purple-700/40 text-white placeholder-purple-300/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl');

  // Additional fixes for select inputs
  content = content.replace(/bg-[#180d38]\/80 text-white placeholder-purple-300\/40/g, 'bg-[#180d38]/80 border border-purple-700/40 text-white placeholder-purple-300/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl');

  // Remove any remaining generic 'text-white' repetitions on those lines if needed
  content = content.replace(/text-white text-white/g, 'text-white');

  fs.writeFileSync(file, content, 'utf8');
});

console.log("Done");
