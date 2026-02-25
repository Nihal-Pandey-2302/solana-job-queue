const fs = require('fs');
const file = './tests/solana-job-queue.ts';
let content = fs.readFileSync(file, 'utf8').split('\n');
const linesToRemove = [
  80, 108, 131, 155, 200, 231, 252, 279, 311, 350, 368, 380, 402, 413, 433, 444, 472, 506, 529, 557, 578, 591, 604, 619, 635, 649, 668, 696, 717
];
// linesToRemove are 1-based.
for (const line of linesToRemove) {
  content[line - 1] = '// ' + content[line - 1]; // Comment it out
}
fs.writeFileSync(file, content.join('\n'));
console.log('Fixed lints!');
