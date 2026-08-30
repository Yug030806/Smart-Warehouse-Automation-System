const fs = require('fs');

const replaceInFile = (file, replacements) => {
  let content = fs.readFileSync(file, 'utf8');
  for (const { regex, replaceValue } of replacements) {
    content = content.replace(regex, replaceValue);
  }
  fs.writeFileSync(file, content);
};

const cleanup = [
  // permissions.ts
  {
    regex: /SUPERVISOR:\s*\{[\s\S]*?canResolveAlerts:\s*true,\s*\},/,
    replaceValue: ''
  },
  // login/page.tsx
  {
    regex: /\{ \s*email:\s*'supervisor@demo\.com',\s*pass:\s*'supervisor123'\s*\},/g,
    replaceValue: ''
  },
  {
    regex: /\?\s*'SUPERVISOR'\s*:\s*email/g,
    replaceValue: '? \'OPERATOR\' : email' // fallback fixing
  },
  // mockDb.ts
  {
    regex: /\{ id: 'u-supervisor',.*?\},/g,
    replaceValue: ''
  },
  {
    regex: /\{ id: 'notif-02', user_id: 'u-supervisor',.*?\},/g,
    replaceValue: ''
  },
  {
    regex: /\{ id: 'notif-03', user_id: 'u-supervisor',.*?\},?/g,
    replaceValue: ''
  },
];

replaceInFile('src/lib/permissions.ts', cleanup);
if(fs.existsSync('src/app/login/page.tsx')) replaceInFile('src/app/login/page.tsx', cleanup);
if(fs.existsSync('src/app/signup/page.tsx')) {
  let s = fs.readFileSync('src/app/signup/page.tsx', 'utf8');
  s = s.replace(/\| 'SUPERVISOR'/g, '');
  fs.writeFileSync('src/app/signup/page.tsx', s);
}
if(fs.existsSync('src/lib/supabase/mockDb.ts')) replaceInFile('src/lib/supabase/mockDb.ts', cleanup);

console.log("Cleanup done.");
