import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  Alert,
  Divider,
  Card,
  CardContent,
} from '@mui/material';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizState {
  questions: QuizQuestion[];
  imageId: string;
}

const Quiz: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { imageId } = location.state || {};

  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!imageId) {
      setError('No image ID provided');
      setLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      try {
        setLoading(true);

        // First try to get the image data from sessionStorage
        const cachedImageData = sessionStorage.getItem(`image-${imageId}`);
        if (cachedImageData) {
          const imageData = JSON.parse(cachedImageData);

          // Check if the image data has the quickQuiz field
          if (imageData.quickQuiz && Array.isArray(imageData.quickQuiz) && imageData.quickQuiz.length > 0) {
            console.log('Using cached quiz data:', imageData.quickQuiz);

            const quizData: QuizState = {
              questions: imageData.quickQuiz,
              imageId: imageId
            };
            setQuiz(quizData);
            setSelectedAnswers(new Array(imageData.quickQuiz.length).fill(-1));
            setError(null);
            setLoading(false);
            return;
          }
        }

        // If no cached data or no quickQuiz field, fetch from the backend
        const response = await axios.get(`${API_URL}/image/${imageId}`);
        console.log('Image data response:', response.data);

        // Check if the response has the quickQuiz field
        if (response.data && response.data.quickQuiz && Array.isArray(response.data.quickQuiz) && response.data.quickQuiz.length > 0) {
          const quizData: QuizState = {
            questions: response.data.quickQuiz,
            imageId: imageId
          };
          setQuiz(quizData);
          setSelectedAnswers(new Array(response.data.quickQuiz.length).fill(-1));
          setError(null);

          // Cache the image data for future use
          sessionStorage.setItem(`image-${imageId}`, JSON.stringify(response.data));
        } else {
          // If no quickQuiz field, generate a new quiz
          const quizResponse = await axios.post(`${API_URL}/generate-quiz`, { imageId });
          console.log('Generated quiz response:', quizResponse.data);

          if (quizResponse.data && quizResponse.data.quiz && Array.isArray(quizResponse.data.quiz)) {
            const quizData: QuizState = {
              questions: quizResponse.data.quiz,
              imageId: quizResponse.data.imageId || imageId
            };
            setQuiz(quizData);
            setSelectedAnswers(new Array(quizResponse.data.quiz.length).fill(-1));
            setError(null);
          } else {
            console.error('Invalid quiz data format:', quizResponse.data);
            setError('The quiz data is in an unexpected format. Please try again.');
          }
        }
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError('Failed to load quiz. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [imageId]);

  const handleAnswerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSelectedAnswers = [...selectedAnswers];
    newSelectedAnswers[currentQuestion] = parseInt(event.target.value);
    setSelectedAnswers(newSelectedAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quiz!.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Check if any questions are missing explanations
      const updatedQuestions = [...quiz!.questions];
      let explanationsAdded = false;

      // For each question without an explanation, generate one
      for (let i = 0; i < updatedQuestions.length; i++) {
        if (!updatedQuestions[i].explanation) {
          explanationsAdded = true;
          // Generate an explanation for this question
          const question = updatedQuestions[i];
          const correctOption = question.options[question.correctAnswer];

          // Create explanations based on the question and correct answer
          let explanation = '';

          // Set a loading message while we fetch the explanation
          explanation = "Generating a detailed explanation...";

          // Update the quiz with the temporary explanation
          updatedQuestions[i].explanation = explanation;

          // We'll fetch the real explanation from the backend in a separate async call
          // This allows us to show results immediately while explanations load in the background
          setTimeout(async () => {
            try {
              const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
              const response = await fetch(`${API_URL}/generate-explanation`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  imageId,
                  question: question.question,
                  options: question.options,
                  correctAnswer: question.correctAnswer
                })
              });

              if (!response.ok) {
                throw new Error(`Failed to generate explanation: ${response.status}`);
              }

              const data = await response.json();

              // Update the quiz with the AI-generated explanation
              const updatedQuizQuestions = [...quiz!.questions];
              updatedQuizQuestions[i].explanation = data.explanation;

              // Update the quiz state with the new explanation
              setQuiz({
                ...quiz!,
                questions: updatedQuizQuestions
              });
            } catch (error) {
              console.error('Error generating explanation:', error);

              // If there's an error, use a fallback explanation
              const fallbackExplanation = `"${correctOption}" is the correct answer based on the information shown in the image.`;

              // Update the quiz with the fallback explanation
              const updatedQuizQuestions = [...quiz!.questions];
              updatedQuizQuestions[i].explanation = fallbackExplanation;

              // Update the quiz state with the fallback explanation
              setQuiz({
                ...quiz!,
                questions: updatedQuizQuestions
              });
            }
          }, 100); // Small delay to ensure the UI updates first
        }
      }

      // Update the quiz with the new questions that have explanations
      if (explanationsAdded) {
        setQuiz({
          ...quiz!,
          questions: updatedQuestions
        });
      }

      // Calculate score
      let totalCorrect = 0;
      for (let i = 0; i < quiz!.questions.length; i++) {
        if (selectedAnswers[i] === quiz!.questions[i].correctAnswer) {
          totalCorrect++;
        }
      }
      setScore(totalCorrect);
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleRetry = () => {
    setSelectedAnswers(new Array(quiz!.questions.length).fill(-1));
    setCurrentQuestion(0);
    setShowResults(false);
  };

  if (loading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Generating quiz questions...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={() => navigate('/results', { state: { imageId } })}>
            Back to Results
          </Button>
        </Box>
      </Container>
    );
  }

  if (!quiz) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            No quiz data available
          </Typography>
          <Button variant="contained" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Box>
      </Container>
    );
  }

  if (showResults) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Quiz Results
          </Typography>

          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              Your Score: {score} / {quiz.questions.length}
            </Typography>
            <Typography variant="body1" paragraph>
              You answered {score} out of {quiz.questions.length} questions correctly.
            </Typography>
          </Paper>

          <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
            Review Your Answers
          </Typography>

          {quiz.questions.map((question, index) => (
            <Card key={index} sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Question {index + 1}: {question.question}
                </Typography>

                <Box sx={{ mb: 2 }}>
                  {question.options.map((option, optIndex) => (
                    <Typography
                      key={optIndex}
                      variant="body1"
                      sx={{
                        color: optIndex === question.correctAnswer
                          ? 'success.main'
                          : (optIndex === selectedAnswers[index] && optIndex !== question.correctAnswer)
                            ? 'error.main'
                            : 'text.primary',
                        fontWeight: optIndex === question.correctAnswer ? 'bold' : 'normal'
                      }}
                    >
                      {String.fromCharCode(65 + optIndex)}. {option}
                      {optIndex === question.correctAnswer && ' ✓'}
                      {optIndex === selectedAnswers[index] && optIndex !== question.correctAnswer && ' ✗'}
                    </Typography>
                  ))}
                </Box>

                <Divider sx={{ my: 2 }} />

                {question.explanation ? (
                  <>
                    <Typography variant="subtitle1" gutterBottom>
                      Explanation:
                    </Typography>
                    <Typography variant="body2">
                      {question.explanation}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary" fontStyle="italic">
                    No explanation available for this question.
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button variant="contained" onClick={handleRetry}>
              Retry Quiz
            </Button>
            <Button variant="outlined" onClick={() => {
              // Retrieve the image data from the cache if available
              const cachedImageData = sessionStorage.getItem(`image-${imageId}`);
              if (cachedImageData) {
                navigate('/results', { state: { data: JSON.parse(cachedImageData) } });
              } else {
                // Fallback to just passing the ID
                navigate('/results', { state: { data: { id: imageId } } });
              }
            }}>
              Back to Results
            </Button>
          </Box>
        </Box>
      </Container>
    );
  }

  const question = quiz.questions[currentQuestion];

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Image Quiz
        </Typography>

        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Question {currentQuestion + 1} of {quiz.questions.length}
          </Typography>

          <FormControl component="fieldset" sx={{ width: '100%', mt: 2 }}>
            <FormLabel component="legend">
              <Typography variant="h6">{question.question}</Typography>
            </FormLabel>
            <RadioGroup
              value={selectedAnswers[currentQuestion].toString()}
              onChange={handleAnswerChange}
              sx={{ mt: 2 }}
            >
              {question.options.map((option, index) => (
                <FormControlLabel
                  key={index}
                  value={index.toString()}
                  control={<Radio />}
                  label={`${String.fromCharCode(65 + index)}. ${option}`}
                  sx={{ mb: 1 }}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            Previous
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={selectedAnswers[currentQuestion] === -1}
          >
            {currentQuestion < quiz.questions.length - 1 ? 'Next' : 'Finish'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default Quiz;
