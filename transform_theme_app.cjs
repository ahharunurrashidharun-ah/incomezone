const fs = require('fs');

const targetFiles = ['src/App.tsx', 'index.html', 'src/index.css'];

targetFiles.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // App.tsx fixes
    content = content.replace(/bg-white rounded-xl shadow-sm border border-gray-100/g, 'bg-[#130b2c]/60 backdrop-blur-xl border border-purple-500/20 shadow-2xl shadow-purple-900/40 rounded-2xl');
    content = content.replace(/text-gray-900/g, 'text-white');
    content = content.replace(/text-gray-500/g, 'text-purple-300/60');

    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log("Done");
