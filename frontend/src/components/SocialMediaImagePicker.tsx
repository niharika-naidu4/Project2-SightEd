import React, { useState } from 'react';
import {
  Box,
  Typography,
  Divider,
  Alert
} from '@mui/material';
import DirectGooglePhotoPicker from './DirectGooglePhotoPicker';

interface SocialMediaImagePickerProps {
  onSelectImage: (file: File) => void;
}

const SocialMediaImagePicker: React.FC<SocialMediaImagePickerProps> = ({ onSelectImage }) => {
  const [googleOauthError, setGoogleOauthError] = useState<boolean>(false);

  const handleSocialMediaPhotoSelect = (blob: Blob, source: string) => {
    console.log(`${source} photo selected, blob:`, blob);

    // Convert blob to File object
    const file = new File([blob], `${source.toLowerCase()}-photo-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
    console.log('Converted blob to file:', file);

    onSelectImage(file);
  };

  const handleGooglePhotoSelect = (blob: Blob) => {
    handleSocialMediaPhotoSelect(blob, 'Google');
  };

  const handleGoogleOAuthError = () => {
    setGoogleOauthError(true);
  };

  return (
    <Box sx={{ mt: 3, p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Import from Google Photos
      </Typography>

      <Divider sx={{ mb: 2 }} />

      <Box>
        {googleOauthError ? (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Google Photos authentication is currently unavailable. Please try again later.
          </Alert>
        ) : (
          <Box sx={{ mt: 2, p: 1, mb: 3 }}>
            <DirectGooglePhotoPicker
              onSelectImage={handleGooglePhotoSelect}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SocialMediaImagePicker;
