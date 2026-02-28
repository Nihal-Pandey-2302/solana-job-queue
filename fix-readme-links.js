const fs = require('fs');

let readme = fs.readFileSync('README.md', 'utf8');

// Replace the Superteam acknowledgement link with the specific bounty link provided
readme = readme.replace(
  'https://earn.superteam.fun',
  'https://superteam.fun/earn/listing/rebuild-production-backend-systems-as-on-chain-rust-programs'
);

// Replace markdown links with HTML target="_blank" links
// Regex negative lookbehind (?<!\!) ensures we don't match image links ![alt](img)
readme = readme.replace(/(?<!\!)\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

fs.writeFileSync('README.md', readme);
console.log("README updated with new tabs and bounty link!");
