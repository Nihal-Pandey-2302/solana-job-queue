#!/bin/bash
# Automated devnet deployment with transaction logging
set -e

# Default to explicitly ensuring devnet
solana config set --url devnet

echo "🚀 Deploying to Devnet..."

# Deploy program
echo "Deploying..."
DEPLOY_RAW=$(solana program deploy ./target/deploy/solana_job_queue.so --url devnet)
DEPLOY_TX=$(echo "$DEPLOY_RAW" | grep "Signature:" | awk '{print $2}')
PROGRAM_ID=$(echo "$DEPLOY_RAW" | grep "Program Id:" | awk '{print $3}')

echo "✅ Deploy TX: $DEPLOY_TX"
echo "https://explorer.solana.com/tx/$DEPLOY_TX?cluster=devnet"
echo "✅ Program ID: $PROGRAM_ID"

echo "Note: Make sure to update your frontend environment variables to point to $PROGRAM_ID"

# Write to DEVNET_TXS.md
cat > DEVNET_TXS.md << EOF
# Devnet Deployment Proofs

- **Program ID:** \`$PROGRAM_ID\`
- **Deploy TX:** [View on Explorer](https://explorer.solana.com/tx/$DEPLOY_TX?cluster=devnet)
EOF

echo "Deployment complete! See DEVNET_TXS.md for proofs."
