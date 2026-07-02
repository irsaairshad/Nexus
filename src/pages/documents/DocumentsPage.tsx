import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Download, Trash2, PenTool, X, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import api from '../../api/axios';
import toast from 'react-hot-toast';

interface Document {
  _id: string;
  name: string;
  originalName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: { _id: string; name: string; email: string };
  status: 'draft' | 'review' | 'approved';
  isSigned: boolean;
  signatureUrl: string;
  version: number;
  createdAt: string;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [signingDoc, setSigningDoc] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Load documents
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/documents');
      setDocuments(response.data);
    } catch (error) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  // Upload document
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);

    setUploading(true);
    try {
      const response = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocuments(prev => [response.data, ...prev]);
      toast.success('Document uploaded successfully!');
    } catch (error) {
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete document
  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d._id !== docId));
      toast.success('Document deleted');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  // Download document
  const handleDownload = (doc: Document) => {
    window.open(`http://localhost:5000${doc.fileUrl}`, '_blank');
  };

  // ── E-Signature Canvas ─────────────────────────────────────────────────

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => { isDrawing.current = false; };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = async () => {
    if (!signingDoc) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureUrl = canvas.toDataURL('image/png');

    try {
      await api.put(`/documents/${signingDoc._id}/sign`, { signatureUrl });
      setDocuments(prev =>
        prev.map(d => d._id === signingDoc._id ? { ...d, isSigned: true, status: 'approved', signatureUrl } : d)
      );
      toast.success('Document signed successfully!');
      setSigningDoc(null);
    } catch (error) {
      toast.error('Failed to save signature');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600">Manage your startup's important files</p>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="hidden"
          />
          <Button
            leftIcon={<Upload size={18} />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Storage info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <h2 className="text-lg font-medium text-gray-900">Storage</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Files</span>
                <span className="font-medium text-gray-900">{documents.length}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-primary-600 rounded-full transition-all"
                  style={{ width: `${Math.min((documents.length / 20) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Signed</span>
                <span className="font-medium text-gray-900">
                  {documents.filter(d => d.isSigned).length}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Filter</h3>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                  All Files ({documents.length})
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                  Signed ({documents.filter(d => d.isSigned).length})
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                  Draft ({documents.filter(d => d.status === 'draft').length})
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Document list */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">All Documents</h2>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-600">No documents yet</p>
                  <p className="text-sm text-gray-500 mt-1">Upload your first document to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div
                      key={doc._id}
                      className="flex items-center p-4 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                    >
                      <div className="p-2 bg-primary-50 rounded-lg mr-4">
                        <FileText size={24} className="text-primary-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {doc.name}
                          </h3>
                          {doc.isSigned && (
                            <Badge variant="success" size="sm">
                              <CheckCircle size={10} className="mr-1" /> Signed
                            </Badge>
                          )}
                          <Badge
                            variant={doc.status === 'approved' ? 'success' : doc.status === 'review' ? 'warning' : 'secondary'}
                            size="sm"
                          >
                            {doc.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>{doc.fileType.toUpperCase()}</span>
                          <span>{formatSize(doc.fileSize)}</span>
                          <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                          <span>by {doc.uploadedBy?.name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-4">
                        <Button variant="ghost" size="sm" className="p-2" onClick={() => handleDownload(doc)} title="Download">
                          <Download size={16} />
                        </Button>
                        {!doc.isSigned && (
                          <Button variant="ghost" size="sm" className="p-2 text-blue-600" onClick={() => setSigningDoc(doc)} title="Sign">
                            <PenTool size={16} />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="p-2 text-red-500" onClick={() => handleDelete(doc._id)} title="Delete">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* E-Signature Modal */}
      {signingDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Sign Document</h2>
              <button onClick={() => setSigningDoc(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                Signing: <span className="font-medium">{signingDoc.name}</span>
              </p>
              <p className="text-xs text-gray-500 mb-2">Draw your signature below:</p>

              <canvas
                ref={canvasRef}
                width={420}
                height={150}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair bg-gray-50"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />

              <div className="flex gap-3 mt-4">
                <Button variant="outline" size="sm" onClick={clearSignature} className="flex-1">
                  Clear
                </Button>
                <Button size="sm" onClick={saveSignature} className="flex-1">
                  Save Signature
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};