import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
} from '@mui/icons-material';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

interface Location {
  latitude: number;
  longitude: number;
}

interface Landmark {
  description: string;
  score: number;
  locations: Location[];
}

interface Label {
  description: string;
  score: number;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface ResultsData {
  id?: string;
  labels: Label[];
  landmarks: Landmark[];
  aiDescription: string;
  scientificFacts?: string[];
  quickQuiz?: QuizQuestion[];
  imageUrl?: string;
  title?: string;
}

const Results: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<ResultsData | null>(location.state?.data as ResultsData);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  // If we only have an ID from navigation state, set it as minimal data
  useEffect(() => {
    if (location.state?.id && !data) {
      console.log('Loading data from ID:', location.state.id);

      // Try to load the saved item from localStorage
      try {
        const savedItemsJson = localStorage.getItem('savedItems');
        if (savedItemsJson) {
          try {
            const savedItems = JSON.parse(savedItemsJson);
            const savedItem = savedItems.find((item: any) => item.id === location.state.id);
            if (savedItem && savedItem.fullData) {
              console.log('Found saved item with full data:', savedItem);
              setData(savedItem.fullData);
              return;
            }
          } catch (parseError) {
            console.error('Error parsing saved items:', parseError);
            // Continue to next storage option
          }
        }
      } catch (localStorageError) {
        console.error('Error accessing localStorage:', localStorageError);
        // Continue to next storage option
      }

      // Try to load from sessionStorage
      try {
        const cachedData = sessionStorage.getItem(`image-${location.state.id}`);
        if (cachedData) {
          try {
            const parsedData = JSON.parse(cachedData);
            console.log('Found cached data in sessionStorage:', parsedData);
            setData(parsedData);
            return;
          } catch (parseError) {
            console.error('Error parsing cached data:', parseError);
            // Continue to minimal data
          }
        }
      } catch (sessionStorageError) {
        console.error('Error accessing sessionStorage:', sessionStorageError);
        // Continue to minimal data
      }

      // If no data found, set minimal data
      console.log('Setting minimal data for ID:', location.state.id);
      setData({
        id: location.state.id,
        labels: [],
        landmarks: [],
        aiDescription: ''
      });
    }
  }, [location.state, data]);

  useEffect(() => {
    // If we only have an ID but no full data, fetch the data from the backend
    const fetchImageData = async (imageId: string) => {
      try {
        setLoading(true);
        setError(null);

        // First check if we have the data in sessionStorage
        const cachedData = sessionStorage.getItem(`image-${imageId}`);
        if (cachedData) {
          try {
            setData(JSON.parse(cachedData));
            setLoading(false);
            return;
          } catch (parseError) {
            console.error('Error parsing cached data:', parseError);
            // Continue to fetch from backend if parsing fails
          }
        }

        // If not in sessionStorage, try to fetch from the backend
        const response = await axios.get(`${API_URL}/image/${imageId}`);
        if (response.data) {
          setData(response.data);
          // Cache the data in sessionStorage for future use
          try {
            // Only store essential data to avoid storage issues
            const essentialData = {
              id: response.data.id,
              aiDescription: response.data.aiDescription,
              scientificFacts: (response.data.scientificFacts || []).slice(0, 3),
              quickQuiz: (response.data.quickQuiz || []).slice(0, 3),
              labels: (response.data.labels || []).slice(0, 5),
              landmarks: (response.data.landmarks || []).slice(0, 2),
              imageUrl: response.data.imageUrl,
              title: response.data.title
            };
            sessionStorage.setItem(`image-${imageId}`, JSON.stringify(essentialData));
          } catch (storageError) {
            console.error('Error storing in sessionStorage:', storageError);
            // Continue even if storage fails
          }
        } else {
          setError('Failed to retrieve image data');
        }
      } catch (err) {
        console.error('Error fetching image data:', err);
        setError('Failed to load image data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // If we have data with just an ID, fetch the full data
    if (data && data.id && (!data.labels || !data.aiDescription)) {
      fetchImageData(data.id);
    }

    // If we have complete data, store it in sessionStorage for future use
    if (data && data.id && data.labels && data.aiDescription) {
      try {
        // Only store essential data to avoid storage issues
        const essentialData = {
          id: data.id,
          aiDescription: data.aiDescription,
          scientificFacts: (data.scientificFacts || []).slice(0, 3),
          quickQuiz: (data.quickQuiz || []).slice(0, 3),
          labels: (data.labels || []).slice(0, 5),
          landmarks: (data.landmarks || []).slice(0, 2),
          imageUrl: data.imageUrl,
          title: data.title
        };
        sessionStorage.setItem(`image-${data.id}`, JSON.stringify(essentialData));
      } catch (storageError) {
        console.error('Error storing in sessionStorage:', storageError);
        // Continue even if storage fails
      }
    }

    // Check if this result is already saved in localStorage
    if (data && data.id) {
      try {
        const savedItems = localStorage.getItem('savedItems');
        if (savedItems) {
          const parsedItems = JSON.parse(savedItems);
          const isAlreadySaved = parsedItems.some((item: any) => item.id === data.id);
          setSaved(isAlreadySaved);
        }
      } catch (error) {
        console.error('Error checking saved status:', error);
        // If we can't check saved status, assume it's not saved
        setSaved(false);
      }
    }
  }, [data]);

  // Function to save the current result
  const handleSaveResult = async () => {
    if (!data || !data.id) return;

    console.log('Saving result with data:', data);

    try {
      // Get existing saved items from localStorage
      const savedItems = localStorage.getItem('savedItems');
      let itemsArray = savedItems ? JSON.parse(savedItems) : [];

      // Check if this item is already saved
      const isAlreadySaved = itemsArray.some((item: any) => item.id === data.id);

      if (!isAlreadySaved) {
        // Check if this is a Google Photos image
        const isGooglePhotosImage = data.imageUrl && data.imageUrl.includes('google');

        // If it's a Google Photos image, convert it to base64 to store locally
        let imageData = null;
        if (isGooglePhotosImage && data.imageUrl) {
          try {
            // Create a function to convert image to base64
            const getBase64FromUrl = async (url: string): Promise<string> => {
              const response = await fetch(url);
              const blob = await response.blob();
              return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            };

            // Try to convert the image to base64
            if (data.imageUrl) {
              imageData = await getBase64FromUrl(data.imageUrl);
              console.log('Converted Google Photos image to base64');
            }
          } catch (error) {
            console.error('Error converting image to base64:', error);
            // Continue without the base64 data
          }
        }

        // Create a new saved item with minimal data to avoid localStorage quota issues
        const newSavedItem = {
          id: data.id,
          imageUrl: data.imageUrl || 'https://via.placeholder.com/400x300?text=Image',
          imageData: imageData, // Store base64 data for Google Photos images
          title: data.title || 'Untitled Image',
          description: data.aiDescription ?
            (data.aiDescription.length > 150 ? data.aiDescription.substring(0, 150) + '...' : data.aiDescription)
            : 'No description available',
          category: 'general',
          isBookmarked: true,
          date: new Date().toISOString().split('T')[0],
          // Store only essential data to reduce storage size
          fullData: {
            id: data.id,
            aiDescription: data.aiDescription,
            // Limit the number of facts and quiz questions to save space
            scientificFacts: (data.scientificFacts || []).slice(0, 3),
            quickQuiz: (data.quickQuiz || []).slice(0, 3),
            // Only store the top 5 labels
            labels: (data.labels || []).slice(0, 5),
            // Only store the top 2 landmarks
            landmarks: (data.landmarks || []).slice(0, 2),
            imageUrl: data.imageUrl,
            imageData: imageData, // Also store in fullData
            title: data.title
          }
        };

        console.log('Created new saved item:', newSavedItem);

        // Limit the number of saved items to prevent quota issues
        if (itemsArray.length >= 20) {
          // Remove the oldest item if we have too many
          itemsArray.shift();
        }

        // Add to array and save to localStorage
        itemsArray.push(newSavedItem);
        localStorage.setItem('savedItems', JSON.stringify(itemsArray));
        setSaved(true);
      } else {
        // Remove from saved items
        itemsArray = itemsArray.filter((item: any) => item.id !== data.id);
        localStorage.setItem('savedItems', JSON.stringify(itemsArray));
        setSaved(false);
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);

      // If we hit quota issues, clear some space
      try {
        // Get existing saved items
        const savedItems = localStorage.getItem('savedItems');
        let itemsArray = savedItems ? JSON.parse(savedItems) : [];

        // If we have more than 5 items, remove the oldest ones to make space
        if (itemsArray.length > 5) {
          itemsArray = itemsArray.slice(-5); // Keep only the 5 most recent items
          localStorage.setItem('savedItems', JSON.stringify(itemsArray));

          // Try saving again
          const isAlreadySaved = itemsArray.some((item: any) => item.id === data.id);
          if (!isAlreadySaved) {
            const minimalSavedItem = {
              id: data.id,
              title: data.title || 'Untitled Image',
              description: 'Saved image',
              date: new Date().toISOString().split('T')[0],
              isBookmarked: true
            };
            itemsArray.push(minimalSavedItem);
            localStorage.setItem('savedItems', JSON.stringify(itemsArray));
            setSaved(true);
          }
        } else {
          // If we still can't save, clear everything and just save this item
          localStorage.clear();
          localStorage.setItem('savedItems', JSON.stringify([{
            id: data.id,
            title: data.title || 'Untitled Image',
            description: 'Saved image',
            date: new Date().toISOString().split('T')[0],
            isBookmarked: true
          }]));
          setSaved(true);
        }
      } catch (secondError) {
        console.error('Failed to recover from localStorage quota error:', secondError);
        alert('Unable to save this item. Please try clearing your browser data and try again.');
      }
    }
  };

  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4 }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading image data...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Box sx={{ mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={() => navigate('/')}>
            Go Back
          </Button>
        </Box>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container>
        <Typography variant="h5" align="center" sx={{ mt: 4 }}>
          No results found. Please upload an image first.
        </Typography>
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button variant="contained" onClick={() => navigate('/')}>
            Go Back
          </Button>
        </Box>
      </Container>
    );
  }

  // Ensure that labels and landmarks are arrays
  const labels = Array.isArray(data.labels) ? data.labels : [];
  const landmarks = Array.isArray(data.landmarks) ? data.landmarks : [];

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 6, mb: 6 }}>
        {/* Display the image */}
        <Paper elevation={0} sx={{ p: 4, mb: 4, border: '1px solid #eaeaea', textAlign: 'center' }}>
          {data.imageUrl ? (
            <Box sx={{ mb: 3 }}>
              <img
                src={data.imageUrl}
                alt={data.title || "Analyzed Image"}
                style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '4px' }}
                onError={(e) => {
                  console.error('Image failed to load:', data.imageUrl);
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
                }}
              />
              <Typography variant="h5" sx={{ mt: 2 }}>
                {data.title || "Analyzed Image"}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ mb: 3, p: 4, bgcolor: '#f5f5f5', borderRadius: '4px' }}>
              <Typography variant="body1" color="text.secondary">
                Image not available
              </Typography>
            </Box>
          )}
        </Paper>

        <Paper elevation={0} sx={{ p: 4, mb: 4, border: '1px solid #eaeaea' }}>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Scene Description
          </Typography>
          <Typography variant="body1">
            {data.aiDescription || 'No description available'}
          </Typography>
        </Paper>

        {data.scientificFacts && data.scientificFacts.length > 0 && (
          <Paper elevation={0} sx={{ p: 4, mb: 4, border: '1px solid #eaeaea' }}>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              Scientific Facts
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 2 }}>
              {data.scientificFacts.map((fact, index) => (
                <Typography component="li" variant="body1" key={index} sx={{ mb: 2 }}>
                  {fact}
                </Typography>
              ))}
            </Box>
          </Paper>
        )}

        {data.quickQuiz && data.quickQuiz.length > 0 && (
          <Paper elevation={0} sx={{ p: 4, mb: 4, border: '1px solid #eaeaea' }}>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              Quick Quiz
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/quiz', { state: { imageId: data.id } })}
                sx={{ mb: 2 }}
              >
                Take Full Quiz
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click the button above to take the quiz and see your results.
              </Typography>
            </Box>
          </Paper>
        )}

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Button
            variant="contained"
            onClick={() => navigate('/')}
            sx={{ px: 3 }}
          >
            Upload New Image
          </Button>
          <Button
            variant={saved ? "contained" : "outlined"}
            color={saved ? "success" : "primary"}
            onClick={handleSaveResult}
            sx={{ px: 3 }}
            startIcon={saved ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          >
            {saved ? "Saved" : "Save Result"}
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/my-collection')}
            sx={{ px: 3, borderColor: '#e0e0e0', color: 'text.primary' }}
          >
            View Saved Items
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default Results;