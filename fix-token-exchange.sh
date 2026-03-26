#!/bin/bash

# Token Exchange Script
# Replace YOUR_CURRENT_TOKEN with your actual token from Graph API Explorer

CURRENT_TOKEN="YOUR_CURRENT_TOKEN_HERE"
CLIENT_ID="843116132106344"
CLIENT_SECRET="2aba0695162b8de6dd571039875faf8c"

curl -X POST "https://graph.facebook.com/v24.0/oauth/access_token" \
  -d "grant_type=fb_exchange_token" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "fb_exchange_token=${CURRENT_TOKEN}"
