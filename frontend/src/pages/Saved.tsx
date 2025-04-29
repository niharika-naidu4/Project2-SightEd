import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  CardActions,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import axios from 'axios';

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

interface SavedImage {
  id: string;
  labels: Label[];
  landmarks: Landmark[];
  aiDescription: string;
  createdAt: string;
}

const Saved: React.FC = () => {
  const navigate = useNavigate();
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSavedImages = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:5001/saved');
        // The API returns { images: [...], page: number, limit: number, total: number }
        if (response.data && response.data.images) {
          setSavedImages(response.data.images);
        } else {
          setSavedImages([]);
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching saved images:', err);
        setError('Failed to load saved images. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSavedImages();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            {error}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Saved Insights
        </Typography>

        {savedImages.length === 0 ? (
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" paragraph>
              No saved images yet
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Upload and analyze an image to see it here.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/')}
              sx={{ mt: 2 }}
            >
              Upload an Image
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {savedImages.map((image) => (
              <Card key={image.id} elevation={3}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {image.aiDescription}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Analyzed on: {formatDate(image.createdAt)}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle1" gutterBottom>
                    Labels
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {image.labels.slice(0, 5).map((label, index) => (
                      <Chip
                        key={index}
                        label={`${label.description} (${(label.score * 100).toFixed(1)}%)`}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                    ))}
                  </Box>

                  {image.landmarks.length > 0 && (
                    <>
                      <Typography variant="subtitle1" gutterBottom>
                        Landmarks
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {image.landmarks.map((landmark, index) => (
                          <Typography key={index} variant="body2">
                            {landmark.description} ({(landmark.score * 100).toFixed(1)}%)
                          </Typography>
                        ))}
                      </Box>
                    </>
                  )}
                </CardContent>
                <CardActions sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Button
                      size="small"
                      onClick={() => navigate('/results', { state: { data: { ...image } } })}
                      sx={{ mr: 1 }}
                    >
                      View Details
                    </Button>
                    <Button
                      size="small"
                      onClick={() => navigate('/')}
                    >
                      Analyze New Image
                    </Button>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="secondary"
                    onClick={() => navigate('/quiz', { state: { imageId: image.id } })}
                  >
                    Take Quiz
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Saved;