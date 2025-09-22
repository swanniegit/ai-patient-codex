# Vercel Deployment Guide

## Overview

The AI Patient Codex multi-modal bio input system is **fully optimized for Vercel serverless deployment**. This guide covers the specific configurations and considerations for running on Vercel.

## Vercel-Specific Optimizations

### ✅ **Serverless File Handling**
- **No folder creation**: Files processed entirely in memory
- **Data URLs**: Uploaded files converted to base64 data URLs
- **No persistent storage**: Files exist only during function execution
- **Memory limits**: File sizes reduced for Vercel's 50MB memory limit

### ✅ **Environment Variables**
Set these in your Vercel project settings:
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### ✅ **Function Limits**
- **Execution time**: 10s for Hobby, 60s for Pro (sufficient for most files)
- **Memory**: 1024MB (handles files up to ~25MB effectively)
- **Request size**: 4.5MB (file uploads handled via streaming)

## Deployment Steps

### 1. Environment Setup
```bash
# In Vercel dashboard or CLI
vercel env add OPENAI_API_KEY
# Paste your OpenAI API key when prompted
```

### 2. Deploy
```bash
# Deploy to Vercel
vercel --prod

# Or connect your GitHub repo for automatic deploys
```

### 3. Test Endpoints
```bash
# Test upload capability
curl https://your-app.vercel.app/api/session/upload

# Test bio processing
curl -X POST https://your-app.vercel.app/api/session/bio \
  -H "Content-Type: application/json" \
  -d '{"inputType": "text", "directInput": {"patient": {"firstName": "Test"}}}'
```

## File Processing Flow (Vercel)

### Upload Flow
1. **Client** uploads file via POST `/api/session/upload`
2. **Formidable** parses multipart data in memory
3. **File** converted to base64 data URL
4. **ArtifactRef** created with `data:` URI
5. **Response** includes artifact ready for processing

### Processing Flow
1. **Client** sends artifact to `/api/session/bio`
2. **OcrAsrAgent** extracts data from data URL
3. **Tesseract.js/Whisper** processes in memory
4. **BioAgent** parses extracted text
5. **Response** includes structured patient data

## File Size Limits (Vercel Optimized)

```javascript
{
  "image": {
    "maxSize": "10MB", // Reduced for Vercel memory
    "formats": ["jpeg", "png", "gif"]
  },
  "audio": {
    "maxSize": "25MB", // Optimized for Whisper + memory
    "formats": ["mp3", "wav", "m4a"]
  },
  "document": {
    "maxSize": "10MB", // PDF processing limit
    "formats": ["pdf"]
  }
}
```

## API Examples (Vercel)

### Upload Image
```bash
curl -X POST https://your-app.vercel.app/api/session/upload \
  -F "file=@patient-id.jpg" \
  -F "description=Patient ID card"
```

**Response:**
```json
{
  "success": true,
  "artifact": {
    "id": "uuid-here",
    "kind": "image",
    "uri": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD...",
    "metadata": {
      "storageType": "dataurl",
      "originalFilename": "patient-id.jpg"
    }
  },
  "deployment": {
    "environment": "vercel",
    "storage": "in-memory"
  }
}
```

### Process with OCR
```bash
curl -X POST https://your-app.vercel.app/api/session/bio \
  -H "Content-Type: application/json" \
  -d '{
    "inputType": "ocr",
    "artifact": {
      "id": "uuid-here",
      "kind": "image",
      "uri": "data:image/jpeg;base64,..."
    }
  }'
```

## Performance Considerations

### Cold Starts
- **Tesseract.js**: ~2-3s initialization on cold start
- **OpenAI**: Minimal cold start impact
- **Total**: First request may take 5-10s

### Warm Performance
- **OCR**: 2-5s for typical ID cards
- **ASR**: 3-8s for 30s audio clips
- **LLM parsing**: 1-2s additional

### Memory Usage
- **Base**: ~50MB function overhead
- **Tesseract**: ~200MB when active
- **Files**: Raw file size in memory
- **Buffer**: Additional ~2x file size during processing

## Error Handling (Vercel)

### Function Timeout
```javascript
// In case of timeout, client receives:
{
  "error": "Function execution timed out",
  "suggestion": "Try smaller files or reduce quality"
}
```

### Memory Limit
```javascript
// If memory exceeded:
{
  "error": "Out of memory",
  "suggestion": "File too large for serverless processing"
}
```

### API Rate Limits
```javascript
// OpenAI rate limiting:
{
  "error": "Rate limit exceeded",
  "suggestion": "Wait and retry"
}
```

## Monitoring & Debugging

### Vercel Logs
```bash
# View function logs
vercel logs

# Monitor real-time
vercel logs --follow
```

### Key Metrics to Watch
- **Execution duration**: Should be <30s for most files
- **Memory usage**: Should stay under 800MB
- **Error rates**: OCR/ASR failures vs file quality
- **Cold start frequency**: Function warmth

## Security (Vercel)

### Data Handling
- ✅ **No persistent storage**: Files never saved to disk
- ✅ **Memory only**: Data exists only during execution
- ✅ **Auto cleanup**: Memory cleared after function ends
- ✅ **HTTPS**: All traffic encrypted by default

### Environment Variables
- ✅ **Encrypted**: Vercel encrypts all environment variables
- ✅ **Access control**: Only functions can access secrets
- ✅ **Audit logs**: Vercel tracks environment changes

## Troubleshooting

### Common Issues

**1. "File too large" errors**
```bash
# Solution: Reduce file size or compress before upload
# Max effective size: ~20MB for images, ~25MB for audio
```

**2. "Function timeout" errors**
```bash
# Solution: Upgrade to Vercel Pro for 60s timeout
# Or optimize files (lower resolution, shorter audio)
```

**3. "OpenAI API key not found"**
```bash
# Solution: Verify environment variable is set
vercel env ls
```

### Performance Tips
1. **Optimize images**: Use JPEG with 80% quality
2. **Compress audio**: Use MP3 at reasonable bitrates
3. **Batch processing**: Process multiple small files vs one large
4. **Retry logic**: Implement client-side retries for cold starts

## Cost Considerations

### Vercel Costs
- **Hobby**: Free tier includes generous serverless functions
- **Pro**: $20/month for production with longer timeouts
- **Function executions**: Usually within free limits for medical use

### OpenAI Costs
- **Whisper**: ~$0.006 per minute of audio
- **GPT-4**: ~$0.01-0.03 per patient record processing
- **Typical**: <$0.10 per complete multi-modal patient intake

## Production Checklist

- [ ] ✅ OPENAI_API_KEY set in Vercel environment
- [ ] ✅ Function timeouts sufficient for your file sizes
- [ ] ✅ Error handling and retry logic implemented
- [ ] ✅ File size validation on client side
- [ ] ✅ Monitoring and alerting configured
- [ ] ✅ Cost tracking enabled

## Next Steps

1. **Deploy**: Push to Vercel with environment variables
2. **Test**: Upload real patient documents/audio
3. **Monitor**: Watch performance and error rates
4. **Scale**: Upgrade plan if needed for production load

The system is **fully production-ready on Vercel** with no file system dependencies! 🚀