# Closest to Pin (CTP) Feature - Implementation Guide

## Database Changes Complete
- Added migration `028_add_ctp_to_scores.sql`
- Backend updated to handle `ctp_feet`, `ctp_inches`, `ctp_image_url` fields
- Schema updated

## To Complete Frontend Implementation

Add the following to `frontend/src/pages/ScoreEntry.jsx`:

### 1. Add state variables (after existing state declarations around line 13):
```javascript
const [ctpData, setCtpData] = useState({}) // { playerId: { feet, inches, imageUrl } }
const [showCtpModal, setShowCtpModal] = useState(false)
const [ctpPlayerId, setCtpPlayerId] = useState(null)
```

### 2. Add CTP handlers (after handleScoreChange function):
```javascript
const handleOpenCtpModal = (playerId) => {
  setCtpPlayerId(playerId)
  setShowCtpModal(true)
}

const handleCloseCtpModal = () => {
  setShowCtpModal(false)
  setCtpPlayerId(null)
}

const handleCtpChange = (field, value) => {
  setCtpData(prev => ({
    ...prev,
    [ctpPlayerId]: {
      ...prev[ctpPlayerId],
      [field]: value
    }
  }))
}

const handleCtpImageChange = (e) => {
  const file = e.target.files[0]
  if (file) {
    // For now, store file name. Image upload to be implemented
    setCtpData(prev => ({
      ...prev,
      [ctpPlayerId]: {
        ...prev[ctpPlayerId],
        imageFile: file,
        imageFileName: file.name
      }
    }))
  }
}

const handleSaveCtp = () => {
  handleCloseCtpModal()
}
```

### 3. Update saveCurrentHole to include CTP data:
Find where `scoresToSave.push({...})` is called and add CTP fields:
```javascript
const playerCtp = ctpData[playerId]
scoresToSave.push({
  tournament_id: selectedTournament.id,
  player_id: playerId,
  hole_id: hole.id,
  score: parseInt(scoreValue),
  quota: quotaValue ? parseFloat(quotaValue) : null,
  foursome_group: foursomeGroup || null,
  ctp_feet: playerCtp?.feet ? parseInt(playerCtp.feet) : null,
  ctp_inches: playerCtp?.inches ? parseFloat(playerCtp.inches) : null,
  ctp_image_url: playerCtp?.imageFileName || null
})
```

### 4. Add CTP button in score entry section:
After the quota input div, add:
```jsx
{holeData?.mens_par === 3 && (
  <div className="mt-2">
    <button
      type="button"
      onClick={() => handleOpenCtpModal(playerId)}
      className={`w-full py-2 px-3 rounded-lg font-semibold text-sm transition ${
        ctpData[playerId] 
          ? 'bg-green-100 text-green-800 border-2 border-green-500' 
          : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200'
      }`}
    >
      {ctpData[playerId] ? '✓ CTP Recorded' : '📍 Set Closest to Pin'}
    </button>
    {ctpData[playerId] && (
      <div className="text-xs text-gray-600 mt-1 text-center">
        {ctpData[playerId].feet}' {ctpData[playerId].inches}"
      </div>
    )}
  </div>
)}
```

### 5. Add CTP Modal before closing div tags:
```jsx
{showCtpModal && ctpPlayerId && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg p-6 w-full max-w-md">
      <h3 className="text-xl font-bold mb-4">
        Closest to Pin - {players.find(p => p.id === ctpPlayerId)?.name}
      </h3>
      
      <div className="mb-4">
        <label className="block text-gray-700 font-semibold mb-2">Distance</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Feet</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="0"
              value={ctpData[ctpPlayerId]?.feet || ''}
              onChange={(e) => handleCtpChange('feet', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Inches</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="11.9"
              step="0.1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="0.0"
              value={ctpData[ctpPlayerId]?.inches || ''}
              onChange={(e) => handleCtpChange('inches', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 font-semibold mb-2">Photo (Optional)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCtpImageChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
        {ctpData[ctpPlayerId]?.imageFileName && (
          <div className="text-sm text-gray-600 mt-2">
            Selected: {ctpData[ctpPlayerId].imageFileName}
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleSaveCtp}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
        >
          Save
        </button>
        <button
          onClick={handleCloseCtpModal}
          className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

## Deployment Steps

1. Run migration on Pi:
```bash
docker exec -it npgolf-mysql-pi mysql -uroot -proot npgolf < migrations/028_add_ctp_to_scores.sql
```

2. Build and deploy:
```bash
.\build-pi.ps1
# On Pi:
docker compose -f docker-compose-pi.yml pull app && docker compose -f docker-compose-pi.yml up -d
```

## Features
- CTP button only appears on Par 3 holes
- Records distance in feet and inches
- Optional photo upload (file name stored for now)
- Visual indicator when CTP is recorded
- Data saved with score entry

## Future Enhancements
- Image upload to cloud storage (AWS S3, Cloudinary, etc.)
- Display CTP leaderboard
- CTP winners page
