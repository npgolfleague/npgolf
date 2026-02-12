# CTP Feature - Ready to Deploy

## What's Complete
✅ Database migration created (028_add_ctp_to_scores.sql)
✅ Backend API updated to save CTP data
✅ Frontend UI complete with modal and par-3 detection
✅ Image preview functionality
✅ Auto-clear CTP data after saving

## Deployment Steps

### 1. Run Migration on Pi
```bash
ssh dalin@192.168.4.111
cd ~/npgolf
docker exec -it npgolf-mysql-pi mysql -uroot -proot npgolf < migrations/028_add_ctp_to_scores.sql
```

### 2. Build and Deploy
On Windows:
```powershell
.\build-pi.ps1
```

On Pi:
```bash
docker compose -f docker-compose-pi.yml pull app
docker compose -f docker-compose-pi.yml up -d
```

## How It Works

1. **Par 3 Detection**: CTP button only appears on holes with par=3
2. **Click Button**: Opens modal to enter feet/inches and optional photo
3. **Enter Distance**: Feet (integer) and Inches (decimal up to 11.9)
4. **Upload Photo**: Optional image from camera or gallery
5. **Save**: CTP data stored with the score for that hole
6. **Visual Feedback**: Green checkmark when CTP is recorded

## Database Fields
- `ctp_feet`: INT (whole feet)
- `ctp_inches`: DECIMAL(3,1) (inches with one decimal place)
- `ctp_image_url`: VARCHAR(255) (currently stores filename, can be upgraded to full URL)

## Future Enhancements
- Upload images to cloud storage (S3, Cloudinary)
- CTP leaderboard page
- Automatic winner calculation
- Share CTP photos on social media
