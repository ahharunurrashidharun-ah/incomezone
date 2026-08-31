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

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Fix table headers
  content = content.replace(/bg-gradient-to-r from-purple-50 to-slate-50/g, 'bg-purple-950/40');
  content = content.replace(/bg-gradient-to-r from-purple-50 to-indigo-50/g, 'bg-purple-950/40');
  content = content.replace(/text-purple-800/g, 'text-amber-400');
  content = content.replace(/text-slate-800/g, 'text-amber-400');
  
  content = content.replace(/hover:bg-slate-50/g, 'hover:bg-purple-900/20');
  content = content.replace(/bg-slate-50\/50/g, 'bg-purple-900/10');
  content = content.replace(/hover:bg-red-50/g, 'hover:bg-red-900/20');
  content = content.replace(/bg-red-50\/50/g, 'bg-red-900/10');
  content = content.replace(/bg-red-50/g, 'bg-red-900/20');
  content = content.replace(/text-slate-900/g, 'text-white');
  content = content.replace(/bg-white/g, 'bg-[#130b2c]/60');

  // Final fix for border-b border-gray-100 inside tables
  content = content.replace(/border-gray-100/g, 'border-purple-500/20');
  content = content.replace(/border-gray-200/g, 'border-purple-500/20');

  fs.writeFileSync(file, content, 'utf8');
});

console.log("Done");
