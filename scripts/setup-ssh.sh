#!/bin/bash
# Setup SSH key from environment variable for git push on Render

set -e

echo "🔑 Setting up SSH key for git..."

# Check if SSH_PRIVATE_KEY environment variable exists
if [ -z "$SSH_PRIVATE_KEY" ]; then
  echo "⚠️  SSH_PRIVATE_KEY environment variable not found"
  echo "ℹ️  Git push will not work without SSH credentials"
  exit 0
fi

# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Decode and write the private key
echo "$SSH_PRIVATE_KEY" | base64 -d > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519

# Add GitHub to known hosts to avoid interactive prompt
ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null

# Start ssh-agent and add key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519 2>/dev/null

# Configure git
git config --global user.name "Acquired Bookshelf Bot"
git config --global user.email "hurleywgly@users.noreply.github.com"

# Set git remote if not already set
if ! git remote get-url origin &>/dev/null; then
  git remote add origin git@github.com:hurleywgly/acquired-bookshelf.git
fi

echo "✅ SSH key configured successfully"
