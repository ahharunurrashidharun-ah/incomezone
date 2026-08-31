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

  content = content.replace(/bg-amber-900\/200\/10/g, 'bg-amber-500/10');
  content = content.replace(/bg-emerald-900\/200\/10/g, 'bg-emerald-500/10');
  content = content.replace(/bg-red-900\/200\/10/g, 'bg-red-500/10');
  content = content.replace(/bg-orange-100/g, 'bg-orange-500/10');
  content = content.replace(/border-indigo-200/g, 'border-purple-500/30');
  content = content.replace(/border-amber-200/g, 'border-amber-500/30');
  content = content.replace(/border-emerald-200/g, 'border-emerald-500/30');
  content = content.replace(/border-red-200/g, 'border-red-500/30');
  content = content.replace(/border-orange-200/g, 'border-orange-500/30');
  content = content.replace(/bg-\[\#130b2c\]\/60\/90/g, 'bg-[#130b2c]/60');
  content = content.replace(/text-slate-500/g, 'text-purple-300/60');
  
  fs.writeFileSync(file, content, 'utf8');
});
console.log("Done");
