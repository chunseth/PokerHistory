import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api.service';
import './ImportHandsPage.css';

const ImportHandsPage = () => {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({
        totalFiles: 0,
        processedFiles: 0,
        totalHands: 0,
        processedHands: 0
    });

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(selectedFiles.map(file => {
            const extractedName = file.name.match(/TN-(.*?)GAMETYPE/)?.[1].trim() || '';
            return {
                file,
                tournamentName: extractedName,
                displayName: extractedName
            };
        }));
        setError(null);
        setSuccess(false);
    };

    const handleTournamentNameChange = (index, value) => {
        setFiles(prevFiles => {
            const newFiles = [...prevFiles];
            newFiles[index] = {
                ...newFiles[index],
                tournamentName: value
            };
            return newFiles;
        });
    };

    const handleRemoveFile = (index) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            setError('Please select at least one file to upload');
            return;
        }

        setUploading(true);
        setError(null);
        setSuccess(false);
        setUploadProgress({
            totalFiles: files.length,
            processedFiles: 0,
            totalHands: 0,
            processedHands: 0
        });

        try {
            for (const fileData of files) {
                const formData = new FormData();
                formData.append('file', fileData.file);
                formData.append('tournamentName', fileData.tournamentName);

                const response = await apiService.uploadHandHistory(formData, (progress) => {
                    setUploadProgress(prev => ({
                        ...prev,
                        processedHands: progress.processedHands,
                        totalHands: progress.totalHands
                    }));
                });

                setUploadProgress(prev => ({
                    ...prev,
                    processedFiles: prev.processedFiles + 1
                }));
            }

            setSuccess(true);
            setFiles([]);
            // Reset file input
            document.getElementById('fileInput').value = '';
            
            // Wait for 2 seconds to show success message before redirecting
            setTimeout(() => {
                navigate('/hand-history');
            }, 1000);
        } catch (error) {
            console.error('Error uploading files:', error);
            setError(error.response?.data?.message || 'Failed to upload files. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="import-hands-page">
            <div className="import-hands-content">
                <h1>Import Hand History</h1>
                
                <div className="upload-section">
                    <div className="file-input-container">
                        <input
                            type="file"
                            id="fileInput"
                            multiple
                            accept=".txt"
                            onChange={handleFileChange}
                            className="file-input"
                        />
                        <label htmlFor="fileInput" className="file-input-label">
                            Choose Files
                        </label>
                        <span className="file-input-text">
                            {files.length > 0 
                                ? `${files.length} file(s) selected` 
                                : 'No files selected'}
                        </span>
                    </div>

                    {files.length > 0 && (
                        <div className="files-list">
                            {files.map((fileData, index) => (
                                <div key={index} className="file-item">
                                    <span className="file-name">{fileData.displayName}</span>
                                    <input
                                        type="text"
                                        placeholder="Tournament Name (optional)"
                                        value={fileData.tournamentName}
                                        onChange={(e) => handleTournamentNameChange(index, e.target.value)}
                                        className="tournament-name-input"
                                    />
                                    <button 
                                        className="remove-file-button"
                                        onClick={() => handleRemoveFile(index)}
                                        title="Remove file"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <button 
                        className="upload-button"
                        onClick={handleUpload}
                        disabled={uploading || files.length === 0}
                    >
                        {uploading ? 'Uploading...' : 'Upload Files'}
                    </button>
                </div>

                {uploading && (
                    <div className="upload-progress">
                        <div className="progress-section">
                            <h3>Files Progress</h3>
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill"
                                    style={{
                                        width: `${(uploadProgress.processedFiles / uploadProgress.totalFiles) * 100}%`
                                    }}
                                />
                            </div>
                            <span className="progress-text">
                                {uploadProgress.processedFiles} / {uploadProgress.totalFiles} files
                            </span>
                        </div>

                        <div className="progress-section">
                            <h3>Hands Progress</h3>
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill"
                                    style={{
                                        width: `${(uploadProgress.processedHands / uploadProgress.totalHands) * 100}%`
                                    }}
                                />
                            </div>
                            <span className="progress-text">
                                {uploadProgress.processedHands} / {uploadProgress.totalHands} hands
                            </span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="success-message">
                        Files uploaded successfully! Redirecting to hand history...
                    </div>
                )}

                <div className="instructions">
                    <h2>Instructions</h2>
                    <ol>
                        <li>Select one or more hand history text files (.txt)</li>
                        <li>Enter a tournament name for each file</li>
                        <li>Click "Upload Files"</li>
                    </ol>
                    <p className="note">
                        Note: Only hands that go beyond preflop and where you are involved will be imported.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ImportHandsPage; 