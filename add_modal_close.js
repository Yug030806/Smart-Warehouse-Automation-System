const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'app');
const targetClass = 'className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm"';
const replacementClass = 'className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll(\'button\')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector(\'svg.lucide-x\')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}';

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(targetClass)) {
        content = content.split(targetClass).join(replacementClass);
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(directoryPath);
