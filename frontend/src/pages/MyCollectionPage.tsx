import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Container,
  Divider,
  Button
} from '@mui/material';
import {
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon
} from '@mui/icons-material';

// Define the ResultsData interface for the full data
interface ResultsData {
  id?: string;
  labels?: any[];
  landmarks?: any[];
  aiDescription?: string;
  scientificFacts?: string[];
  quickQuiz?: any[];
  imageUrl?: string;
  title?: string;
}

// Define the SavedItem interface
interface SavedItem {
  id: string;
  imageUrl: string;
  imageData?: string; // Base64 encoded image data for Google Photos
  title: string;
  description: string;
  category: string;
  isBookmarked: boolean;
  date: string;
  fullData?: ResultsData;
}

const MyCollectionPage: React.FC = () => {
  const navigate = useNavigate();

  // State for saved items
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved items
  useEffect(() => {
    // Get saved items from localStorage
    const fetchSavedItems = () => {
      try {
        const savedItemsJson = localStorage.getItem('savedItems');
        if (savedItemsJson) {
          try {
            const items = JSON.parse(savedItemsJson);

            // Validate items and ensure they have all required fields
            const validItems = items.filter((item: any) => {
              // Check if item is an object and has an id
              return item && typeof item === 'object' && item.id;
            }).map((item: any) => {
              // Ensure all required fields have default values if missing
              return {
                id: item.id,
                imageUrl: item.imageUrl || 'https://via.placeholder.com/400x300?text=Image',
                imageData: item.imageData || null, // Include imageData for Google Photos
                title: item.title || 'Untitled Image',
                description: item.description || 'No description available',
                category: item.category || 'general',
                isBookmarked: item.isBookmarked !== undefined ? item.isBookmarked : true,
                date: item.date || new Date().toISOString().split('T')[0],
                fullData: item.fullData || null
              };
            });

            setSavedItems(validItems);
          } catch (error) {
            console.error('Error parsing saved items:', error);
            setSavedItems([]);
          }
        } else {
          setSavedItems([]);
        }
      } catch (error) {
        console.error('Error accessing localStorage:', error);
        setSavedItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSavedItems();
  }, []);

  // Handle bookmark toggle
  const handleBookmarkToggle = (id: string) => {
    console.log('Toggling bookmark for item:', id);

    try {
      // Update state
      const updatedItems = savedItems.map(item =>
        item.id === id ? { ...item, isBookmarked: !item.isBookmarked } : item
      );
      setSavedItems(updatedItems);

      // Save to localStorage
      try {
        localStorage.setItem('savedItems', JSON.stringify(updatedItems));
        console.log('Updated saved items in localStorage');
      } catch (error) {
        console.error('Error saving to localStorage:', error);
        // Continue with state update even if localStorage fails
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  // Handle item removal
  const handleRemoveItem = (id: string) => {
    console.log('Removing item:', id);

    try {
      // Remove from state
      const updatedItems = savedItems.filter(item => item.id !== id);
      setSavedItems(updatedItems);

      // Save to localStorage
      try {
        localStorage.setItem('savedItems', JSON.stringify(updatedItems));
        console.log('Updated saved items in localStorage after removal');
      } catch (error) {
        console.error('Error saving to localStorage after removal:', error);
        // Continue with state update even if localStorage fails
      }
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        My Collection
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="body1" color="text.secondary" paragraph>
          View and manage your saved insights.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Results Count */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Showing {savedItems.length} items
        </Typography>
      </Box>

      {/* Grid of Saved Items */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        {savedItems.map((item) => (
          <Box key={item.id} sx={{ width: { xs: '100%', sm: '45%', md: '30%' } }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardMedia
                component="div"
                sx={{
                  height: 200,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundColor: '#f5f5f5'
                }}
              >
                <img
                  src={item.imageData ?
                    item.imageData :
                    item.imageUrl}
                  alt={item.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                  onError={(e) => {
                    console.error('Image failed to load:', item.imageUrl);
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
                    target.style.objectFit = 'contain';
                  }}
                />
              </CardMedia>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h6" component="div">
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {item.description}
                </Typography>
                <Chip
                  label={item.category ? (item.category.charAt(0).toUpperCase() + item.category.slice(1)) : 'General'}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Saved on {item.date ? new Date(item.date).toLocaleDateString() : 'Unknown date'}
                </Typography>
              </CardContent>
              <CardActions disableSpacing>
                <IconButton
                  aria-label="toggle bookmark"
                  onClick={() => handleBookmarkToggle(item.id)}
                >
                  {item.isBookmarked ?
                    <BookmarkIcon color="primary" /> :
                    <BookmarkBorderIcon />
                  }
                </IconButton>
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleRemoveItem(item.id)}
                  sx={{ ml: 'auto' }}
                >
                  Remove
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    try {
                      console.log('Viewing item with data:', item.fullData || item);

                      // Create a minimal valid data object
                      const minimalData = {
                        id: item.id,
                        imageUrl: item.imageUrl || 'https://via.placeholder.com/400x300?text=Image',
                        title: item.title || 'Untitled Image',
                        aiDescription: item.description || 'No description available',
                        labels: [],
                        landmarks: []
                      };

                      // Use fullData if available, otherwise use minimal data
                      const dataToPass = item.fullData || minimalData;

                      navigate('/results', {
                        state: {
                          data: dataToPass
                        }
                      });
                    } catch (error) {
                      console.error('Error navigating to results:', error);
                      // Fallback to a simpler navigation if there's an error
                      navigate('/results', {
                        state: {
                          id: item.id
                        }
                      });
                    }
                  }}
                >
                  View
                </Button>
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Empty State */}
      {savedItems.length === 0 && !isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No saved items found
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            You haven't saved any analysis results yet.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/')}
            sx={{ mt: 2 }}
          >
            Upload an Image
          </Button>
        </Box>
      )}

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            Loading your collection...
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default MyCollectionPage;
