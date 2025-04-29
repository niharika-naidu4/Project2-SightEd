import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import GoogleIcon from '@mui/icons-material/Google';

import SocialMediaImagePicker from '../components/SocialMediaImagePicker';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      if (!selectedFile.type.startsWith('image/')) {
        setError('Only image files are allowed');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Please select an image file');
      return;
    }

    console.log('Starting image upload process with file:', file);
    setLoading(true);
    setError(null);

    // Create a data URL from the file
    const createImageDataUrl = () => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(e.target.result as string);
          } else {
            resolve('');
          }
        };
        reader.readAsDataURL(file);
      });
    };

    // Get the data URL before sending the request
    const imageDataUrl = await createImageDataUrl();
    console.log('Created image data URL');

    const formData = new FormData();
    formData.append('image', file);

    try {
      console.log('Sending request to:', `${API_URL}/upload`);
      console.log('API_URL value:', API_URL);
      console.log('File details:', {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: new Date(file.lastModified).toISOString()
      });

      // Add a timeout to the request to prevent hanging
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 second timeout
        withCredentials: false // Disable sending cookies
      });

      console.log('Response received:', response);

      // Add the image data URL to the response data
      const enhancedData = {
        ...response.data,
        imageUrl: imageDataUrl,
        title: file.name || 'Untitled Image'
      };

      // Store the enhanced image data in sessionStorage for future use
      if (enhancedData.id) {
        console.log('Storing enhanced image data with ID:', enhancedData.id);
        sessionStorage.setItem(`image-${enhancedData.id}`, JSON.stringify(enhancedData));
      }

      console.log('Navigating to results with enhanced data');
      navigate('/results', { state: { data: enhancedData } });
    } catch (err: any) {
      console.error('Error uploading image:', err);

      // More detailed error logging
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error response data:', err.response.data);
        console.error('Error response status:', err.response.status);
        console.error('Error response headers:', err.response.headers);

        // Special handling for quota exceeded errors
        if (err.response.status === 429 ||
            (err.response.data?.error && err.response.data.error.includes('quota'))) {
          setError('The quota has been exceeded. Daily limit for image analysis has been reached.');
        } else {
          setError(err.response.data?.error || `Server error: ${err.response.status}`);
        }
      } else if (err.request) {
        // The request was made but no response was received
        console.error('Error request:', err.request);
        setError('No response received from server. Please check your internet connection and try again.');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', err.message);
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialMediaImageSelect = (selectedFile: File) => {
    console.log('Social media image selected:', selectedFile);
    setFile(selectedFile);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, mb: 6, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          SightEd
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
          Upload any image to discover educational insights and facts
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 4 }}
          action={
            error.includes('quota') ? (
              <Button color="inherit" size="small" onClick={() => setError(null)}>
                Dismiss
              </Button>
            ) : undefined
          }
        >
          {error.includes('quota') ? (
            <>
              <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                Daily Limit Reached
              </Typography>
              <Typography variant="body2">
                The daily quota for image analysis has been exceeded. This is a free service with limited capacity.
                Please try again tomorrow or use a different image analysis service.
              </Typography>
            </>
          ) : (
            error
          )}
        </Alert>
      )}

      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<GoogleIcon />}
            sx={{
              py: 1.5,
              px: 3,
              borderColor: '#e0e0e0',
              color: 'text.primary',
              '&:hover': { borderColor: '#bdbdbd', backgroundColor: 'rgba(0, 0, 0, 0.01)' }
            }}
            onClick={() => setActiveTab(1)}
          >
            Import from Google Photos
          </Button>
        </Box>

        <Typography align="center" sx={{ my: 2 }}>or</Typography>

        <Box
          component="label"
          htmlFor="image-upload"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed #e0e0e0',
            borderRadius: 2,
            p: 8,
            textAlign: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.01)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'rgba(25, 118, 210, 0.04)'
            }
          }}
        >
          <input
            accept="image/*"
            style={{ display: 'none' }}
            id="image-upload"
            type="file"
            onChange={handleFileChange}
            disabled={loading}
          />
          <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 3 }} />
          <Typography variant="h6" gutterBottom>
            Upload an Image
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Drag and drop an image here, or click to select from your device
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Supported formats: JPG, PNG, GIF (max 5MB)
          </Typography>
        </Box>

        {file && (
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Selected: {file.name}
            </Typography>

            <Button
              variant="contained"
              color="primary"
              sx={{ px: 4, py: 1 }}
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Analyze Image'
              )}
            </Button>
          </Box>
        )}
      </Box>

      {activeTab === 1 && (
        <Paper elevation={0} sx={{ p: 4, border: '1px solid #eaeaea' }}>
          <SocialMediaImagePicker onSelectImage={handleSocialMediaImageSelect} />

          {file && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Selected: {file.name}
              </Typography>

              <Button
                variant="contained"
                color="primary"
                sx={{ px: 4, py: 1 }}
                disabled={loading}
                onClick={handleSubmit}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Analyze Image'
                )}
              </Button>
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
};

export default Home;
