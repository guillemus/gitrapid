#!/bin/bash
ENV_FILE="${1:-.env}"
ENVIRONMENT="${2:-production}"

# The vercel dashboard for managing env vars surprisingly sucks quite a lot for many env vars, this makes it easy to first env pull, fix env vars, then env push

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

echo "Pushing $ENV_FILE to $ENVIRONMENT environment..."

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

  # Extract key (everything before first =)
  key="${line%%=*}"
  # Extract value (everything after first =)
  value="${line#*=}"

  # Skip if no = found (invalid line)
  [[ "$key" == "$line" ]] && continue

  # Trim whitespace from key
  key="${key// /}"

  # Remove surrounding quotes if present
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  echo "Adding $key..."
  tmpfile=$(mktemp)
  printf '%s' "$value" > "$tmpfile"
  bunx vercel env add "$key" "$ENVIRONMENT" --force < "$tmpfile"
  rm "$tmpfile"
done < "$ENV_FILE"

echo "Done!"
