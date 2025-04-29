import React, { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  TextField,
  Button,
  Container,
  Grid,
  Paper,
  Divider,
  Alert,
  Snackbar,
  CircularProgress
} from '@mui/material';
import { Send as SendIcon, Email as EmailIcon, Info as InfoIcon } from '@mui/icons-material';

// API URL from environment variables
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const ContactPage: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  // Form validation state
  const [formErrors, setFormErrors] = useState({
    name: false,
    email: false,
    subject: false,
    message: false
  });

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user types
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: false
      }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors = {
      name: formData.name.trim() === '',
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email),
      subject: formData.subject.trim() === '',
      message: formData.message.trim() === ''
    };

    setFormErrors(errors);
    return !Object.values(errors).some(error => error);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(false);

    try {
      // Send data to the backend API
      const response = await axios.post(`${API_URL}/api/contact`, formData);

      console.log('Contact form submission successful:', response.data);

      // Show success message
      setSubmitSuccess(true);

      // Reset form after successful submission
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    } catch (error) {
      console.error('Error submitting contact form:', error);
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSubmitSuccess(false);
    setSubmitError(false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={4}>
        {/* Contact Form Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Contact Us
            </Typography>

            <Typography variant="body1" color="text.secondary" paragraph>
              Have questions or feedback? We'd love to hear from you. Fill out the form below and we'll get back to you as soon as possible.
            </Typography>

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4 }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    required
                    fullWidth
                    label="Your Name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    error={formErrors.name}
                    helperText={formErrors.name ? "Name is required" : ""}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    required
                    fullWidth
                    label="Email Address"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    error={formErrors.email}
                    helperText={formErrors.email ? "Valid email is required" : ""}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    required
                    fullWidth
                    label="Subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    error={formErrors.subject}
                    helperText={formErrors.subject ? "Subject is required" : ""}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    required
                    fullWidth
                    label="Message"
                    name="message"
                    multiline
                    rows={6}
                    value={formData.message}
                    onChange={handleInputChange}
                    error={formErrors.message}
                    helperText={formErrors.message ? "Message is required" : ""}
                  />
                </Grid>
                <Grid size={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    endIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>

        {/* About Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper elevation={3} sx={{ p: 4, height: '100%' }}>
            <Typography variant="h5" gutterBottom>
              About SightEd
            </Typography>

            <Typography variant="body1" paragraph>
              SightEd is an innovative educational platform that transforms how we learn from images. Using advanced AI technology, it analyzes uploaded photos to generate comprehensive insights including detailed scene descriptions, relevant scientific facts, and interactive quizzes.
            </Typography>

            <Typography variant="body1" paragraph>
              Perfect for students, educators, and curious minds alike, SightEd makes visual learning more engaging and accessible by turning everyday images into rich educational experiences.
            </Typography>

            <Typography variant="body1" paragraph>
              With features like Google Photos integration and a personalized saved insights collection, SightEd bridges the gap between visual content and meaningful learning, helping users discover the educational value hidden within the images around them.
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Success/Error Notifications */}
      <Snackbar open={submitSuccess} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          Your message has been sent successfully! We'll get back to you soon.
        </Alert>
      </Snackbar>

      <Snackbar open={submitError} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
          There was an error sending your message. Please check your internet connection and try again.
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ContactPage;
