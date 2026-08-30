const fs = require('fs');

const replaceInFile = (file, replacements) => {
  let content = fs.readFileSync(file, 'utf8');
  for (const { searchValue, replaceValue } of replacements) {
    content = content.split(searchValue).join(replaceValue);
  }
  fs.writeFileSync(file, content);
};

const typeReplacements = [
  { searchValue: " | 'SUPERVISOR'", replaceValue: "" },
  { searchValue: ", 'SUPERVISOR'", replaceValue: "" },
  { searchValue: "['MANAGER', 'SUPERVISOR']", replaceValue: "['MANAGER']" },
  { searchValue: "role: 'SUPERVISOR' as const,", replaceValue: "" },
  { searchValue: "SUPERVISOR: 'Warehouse Supervisor',", replaceValue: "" },
];

const files = [
  'src/lib/permissions.ts',
  'src/lib/supabase/mockDb.ts',
  'src/lib/supabase/AuthProvider.tsx',
  'src/components/Sidebar.tsx',
  'src/lib/database.types.ts',
  'src/app/login/page.tsx',
  'src/app/analytics/page.tsx',
  'src/app/boxes/page.tsx',
  'src/app/vehicles/page.tsx',
  'src/app/users/page.tsx',
  'supabase-schema.sql'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    replaceInFile(file, typeReplacements);
    console.log(`Updated ${file}`);
  }
});
