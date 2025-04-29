import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Email as EmailIcon, Visibility as VisibilityIcon } from '@mui/icons-material';

// API URL from environment variables
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const AdminContactPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch contact form submissions
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get(`${API_URL}/api/contact`);
        setSubmissions(response.data.submissions);
      } catch (err) {
        console.error('Error fetching contact submissions:', err);
        setError('Failed to load contact submissions. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, []);

  // Format date string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle opening the detail dialog
  const handleOpenDialog = (submission: ContactSubmission) => {
    setSelectedSubmission(submission);
    setDialogOpen(true);
  };

  // Handle closing the detail dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Contact Form Submissions
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          View and manage messages from your contact form.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : submissions.length === 0 ? (
          <Alert severity="info">
            No contact form submissions yet.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>{formatDate(submission.createdAt)}</TableCell>
                    <TableCell>{submission.name}</TableCell>
                    <TableCell>{submission.email}</TableCell>
                    <TableCell>{submission.subject}</TableCell>
                    <TableCell>
                      <Chip 
                        label={submission.read ? "Read" : "Unread"} 
                        color={submission.read ? "default" : "primary"} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        startIcon={<VisibilityIcon />}
                        size="small"
                        onClick={() => handleOpenDialog(submission)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        {selectedSubmission && (
          <>
            <DialogTitle>
              <Typography variant="h6">{selectedSubmission.subject}</Typography>
              <Typography variant="body2" color="text.secondary">
                From: {selectedSubmission.name} ({selectedSubmission.email})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Received: {formatDate(selectedSubmission.createdAt)}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body1" paragraph>
                {selectedSubmission.message}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button 
                startIcon={<EmailIcon />}
                href={`mailto:${selectedSubmission.email}?subject=Re: ${selectedSubmission.subject}`}
                color="primary"
              >
                Reply via Email
              </Button>
              <Button onClick={handleCloseDialog}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminContactPage;
