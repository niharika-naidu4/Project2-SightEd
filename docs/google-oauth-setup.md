# Google OAuth Setup Guide

This guide explains how to set up Google OAuth for SightEd, particularly for importing Google Photos.

## Adding Test Users to Your Google Cloud Console Project

Since the app is not verified by Google, you need to add your Google account as a test user to access the Google Photos API. Here's how:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one with client ID: `438241696160-mf0vdpqfqftrmjl4377fo9e33tjtk8rv.apps.googleusercontent.com`)
3. Navigate to "APIs & Services" > "OAuth consent screen"
4. Scroll down to the "Test users" section
5. Click "Add users"
6. Enter your Google email address and any other users you want to grant access to
7. Click "Save"

After adding yourself as a test user, you should be able to sign in with your Google account to import Google Photos.

## Troubleshooting OAuth Errors

If you encounter OAuth errors when trying to sign in with Google Photos, check the following:

1. **Verify you're using a test user account**: Make sure the Google account you're trying to use is added as a test user in the Google Cloud Console.

2. **Check authorized redirect URIs**: In the Google Cloud Console, go to "APIs & Services" > "Credentials", find your OAuth client ID, and make sure the following redirect URIs are authorized:
   - `http://localhost:3000`
   - `http://localhost:5001/auth/google-simple/callback`

3. **Check enabled APIs**: Make sure the "Google Photos Library API" is enabled for your project. Go to "APIs & Services" > "Library" and search for "Photos Library API".

4. **Clear browser cookies and cache**: Sometimes OAuth issues can be resolved by clearing your browser's cookies and cache.

## Verifying Your App with Google

If you plan to make your app available to more users, you should go through Google's verification process:

1. Complete your app's privacy policy and terms of service
2. Add a logo and detailed app information
3. Submit your app for verification through the Google Cloud Console

For more information, see [Google's OAuth verification documentation](https://support.google.com/cloud/answer/9110914).
