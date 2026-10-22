import React from 'react';
import { Card, CardContent, Typography, Box, Grid, Dialog, useTheme } from '@mui/material';
import { Camera } from 'lucide-react';

export const ScreenshotsGallery = ({ screenshots = [] }) => {
  const theme = useTheme();
  const [selectedImg, setSelectedImg] = React.useState(null);

  return (
    <Card sx={{ borderRadius: 4, mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Camera size={22} color={theme.palette.primary.main} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Automated Proctoring Screenshots Captured
          </Typography>
        </Box>

        {screenshots.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', backgroundColor: theme.palette.surface.main, borderRadius: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No evidence screenshots captured for this session.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {screenshots.map((s, idx) => (
              <Grid item xs={12} sm={6} md={4} key={idx}>
                <Box
                  sx={{
                    position: 'relative',
                    borderRadius: 3,
                    overflow: 'hidden',
                    height: 180,
                    backgroundColor: '#000',
                    cursor: 'pointer',
                    '&:hover img': { transform: 'scale(1.05)' }
                  }}
                  onClick={() => setSelectedImg(s.url || s)}
                >
                  <img
                    src={s.url || s}
                    alt="Proctor evidence"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      p: 1.5,
                      background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.92) 100%)',
                      color: '#fff'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', color: '#38bdf8' }}>
                        {s.reason || 'Suspicious Event Frame'}
                      </Typography>
                      {s.severity && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            px: 0.8,
                            py: 0.2,
                            borderRadius: 1,
                            bgcolor: s.severity === 'High' ? '#ef4444' : s.severity === 'Medium' ? '#f59e0b' : '#10b981',
                            color: '#fff'
                          }}
                        >
                          {s.severity}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', opacity: 0.85, fontSize: '0.7rem' }}>
                      <span>🕒 {s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : 'Snapshot'}</span>
                      {s.confidence && <span>Conf: {s.confidence}</span>}
                    </Box>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>

      {/* Lightbox Dialog */}
      <Dialog open={Boolean(selectedImg)} onClose={() => setSelectedImg(null)} maxWidth="lg">
        <Box sx={{ p: 1, bgcolor: '#000' }}>
          {selectedImg && (
            <img src={selectedImg} alt="Enlarged Screenshot" style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block' }} />
          )}
        </Box>
      </Dialog>
    </Card>
  );
};

export default ScreenshotsGallery;
