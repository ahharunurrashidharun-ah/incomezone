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

  // Fix up duplicate strings
  content = content.replace(/border-purple-500\/20 border-purple-500\/20/g, 'border-purple-500/20');
  content = content.replace(/border border-purple-500\/20 border border-purple-500\/20/g, 'border border-purple-500/20');
  content = content.replace(/bg-\[\#130b2c\]\/60 backdrop-blur-xl bg-\[\#130b2c\]\/60 backdrop-blur-xl/g, 'bg-[#130b2c]/60 backdrop-blur-xl');
  content = content.replace(/bg-\[\#130b2c\]\/60 bg-\[\#130b2c\]\/60/g, 'bg-[#130b2c]/60');
  content = content.replace(/border border-purple-500\/20 border-purple-500\/20/g, 'border border-purple-500/20');

  // Any remaining generic grays
  content = content.replace(/text-gray-900/g, 'text-white');
  content = content.replace(/text-gray-800/g, 'text-purple-100');
  content = content.replace(/text-gray-700/g, 'text-purple-200');
  content = content.replace(/text-gray-600/g, 'text-purple-200/80');
  content = content.replace(/text-gray-500/g, 'text-purple-300/60');
  content = content.replace(/text-gray-400/g, 'text-purple-300/40');
  content = content.replace(/bg-gray-50/g, 'bg-purple-900/20');
  content = content.replace(/bg-gray-100/g, 'bg-purple-900/30');

  fs.writeFileSync(file, content, 'utf8');
});

console.log("Done");
