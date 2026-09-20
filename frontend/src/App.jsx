import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  analyzeDocument,
  deleteDocument,
  fetchDocuments,
  fetchSystemStatus,
  getDocumentDetail,
  updateActionStatus,
  uploadDocument,
} from "./services/api";

const statusOptions = ["Pending", "In Progress", "Completed"];

function EmptyPanel({ icon, title, message }) {
  return (
    <div className="empty-panel">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

function StatusSelect({ value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!selectRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="premium-select" ref={selectRef}>
      <button
        type="button"
        className="premium-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{value}</span>
        <span className="premium-select-chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {isOpen && (
        <div className="premium-select-menu" role="listbox">
          <div className="premium-select-label">Update status</div>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option === value}
              className={option === value ? "selected" : ""}
              key={option}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              <span className="status-option-dot" aria-hidden="true" />
              {option}
              {option === value && (
                <span className="status-option-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusVisual({ status, isUpdating }) {
  const state = isUpdating
    ? "updating"
    : status.toLowerCase().replace(" ", "-");
  return (
    <span
      className={`status-visual status-${state}`}
      aria-label={`Status: ${status}`}
    >
      <span className="status-visual-core">
        {status === "Completed" ? "✓" : ""}
      </span>
    </span>
  );
}

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [documentDetail, setDocumentDetail] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [documentPendingDelete, setDocumentPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentView, setCurrentView] = useState("overview");
  const [actionFeedback, setActionFeedback] = useState("");
  const [updatingActionId, setUpdatingActionId] = useState(null);
  const [geminiStatus, setGeminiStatus] = useState({
    gemini_configured: false,
    model: "gemini-2.5-flash",
    message: "Checking Gemini status...",
  });

  const loadDocuments = async () => {
    try {
      setIsLoadingDocuments(true);
      const data = await fetchDocuments();
      setDocuments(data);
      if (!selectedDocumentId && data.length > 0) {
        setSelectedDocumentId(data[0].id);
      }
    } catch (err) {
      setError(err.message || "Unable to load documents.");
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  useEffect(() => {
    loadDocuments();

    fetchSystemStatus()
      .then((status) => setGeminiStatus(status))
      .catch(() =>
        setGeminiStatus({
          gemini_configured: false,
          model: "gemini-2.5-flash",
          message: "Gemini status unavailable.",
        }),
      );
  }, []);

  useEffect(() => {
    if (!selectedDocumentId) {
      setDocumentDetail(null);
      return;
    }

    const fetchDetail = async () => {
      try {
        const detail = await getDocumentDetail(selectedDocumentId);
        setDocumentDetail(detail);
      } catch (err) {
        setError(err.message || "Unable to fetch document details.");
      }
    };

    fetchDetail();
  }, [selectedDocumentId]);

  const stats = useMemo(() => {
    const pendingActions =
      documentDetail?.actions?.filter((item) => item.status === "Pending")
        .length || 0;
    const highPriorityRisks =
      documentDetail?.analysis?.risks?.filter(
        (item) => item.severity === "High",
      ).length || 0;
    const upcomingDeadlines = documentDetail?.analysis?.deadlines?.length || 0;
    return {
      totalDocuments: documents.length,
      pendingActions,
      highPriorityRisks,
      upcomingDeadlines,
    };
  }, [documents, documentDetail]);

  const actionProgress = useMemo(() => {
    const actions = documentDetail?.actions || [];
    const completed = actions.filter(
      (item) => item.status === "Completed",
    ).length;
    return {
      total: actions.length,
      completed,
      percentage: actions.length
        ? Math.round((completed / actions.length) * 100)
        : 0,
    };
  }, [documentDetail]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a valid PDF file.");
      setSelectedFile(null);
      return;
    }

    setError("");
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please choose a PDF before uploading.");
      return;
    }

    try {
      setError("");
      setUploadMessage("Uploading...");
      setIsUploading(true);
      const result = await uploadDocument(selectedFile);
      const newDocument = result.document;
      setSelectedDocumentId(newDocument.id);
      setSelectedFile(null);
      setDocuments((current) => [
        { ...newDocument, analysis_status: "pending" },
        ...current,
      ]);
      setUploadMessage("Extracting text...");

      setUploadMessage("Analyzing with AI...");
      await analyzeDocument(newDocument.id);
      setUploadMessage("Analysis complete");
      await loadDocuments();
      const detail = await getDocumentDetail(newDocument.id);
      setDocumentDetail(detail);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
      setUploadMessage("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async (documentId) => {
    try {
      setIsAnalyzing(true);
      setError("");
      setUploadMessage("Analyzing with AI...");
      await analyzeDocument(documentId);
      setUploadMessage("Analysis complete");
      const detail = await getDocumentDetail(documentId);
      setDocumentDetail(detail);
      await loadDocuments();
    } catch (err) {
      setError(err.message || "AI analysis failed.");
    } finally {
      setIsAnalyzing(false);
      setUploadMessage("");
    }
  };

  const handleDelete = async (documentId) => {
    try {
      setIsDeleting(true);
      await deleteDocument(documentId);
      const nextDocuments = documents.filter((doc) => doc.id !== documentId);
      setDocuments(nextDocuments);
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId(nextDocuments[0]?.id || null);
      }
      if (documentDetail?.id === documentId) {
        setDocumentDetail(null);
      }
    } catch (err) {
      setError(err.message || "Unable to delete document.");
    } finally {
      setIsDeleting(false);
      setDocumentPendingDelete(null);
    }
  };

  const handleStatusChange = async (actionId, nextStatus) => {
    try {
      setUpdatingActionId(actionId);
      const changedAction = documentDetail?.actions?.find(
        (item) => item.id === actionId,
      );
      await updateActionStatus(actionId, nextStatus);
      const updatedDetail = await getDocumentDetail(selectedDocumentId);
      setDocumentDetail(updatedDetail);
      setActionFeedback(
        nextStatus === "Completed"
          ? `Requirement completed: ${changedAction?.title || "Action item"}`
          : `${changedAction?.title || "Action item"} moved to ${nextStatus.toLowerCase()}.`,
      );
      window.setTimeout(() => setActionFeedback(""), 4200);
    } catch (err) {
      setError(err.message || "Unable to update action status.");
    } finally {
      setUpdatingActionId(null);
    }
  };

  const activeDocument =
    documents.find((doc) => doc.id === selectedDocumentId) || null;

  const navigateTo = (view) => {
    setCurrentView(view);
    setError("");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            D
          </div>
          <div>
            <h1>DocuFlow AI</h1>
            <span className="brand-version">INTELLIGENCE STUDIO / 01</span>
          </div>
          <p>Document-to-Action System</p>
        </div>

        <div className={`upload-panel ${isUploading ? "is-uploading" : ""}`}>
          <div className="upload-heading">
            <span className="upload-status-orb" aria-hidden="true">
              <span />
            </span>
            <div>
              <strong>
                {isUploading
                  ? uploadMessage || "Processing document"
                  : "Bring a document to life"}
              </strong>
              <small>
                {isUploading
                  ? "Extracting signals and preparing analysis"
                  : "PDF up to 10 MB"}
              </small>
            </div>
          </div>
          <label className="upload-label" htmlFor="pdf-upload">
            <span className="upload-orbit" aria-hidden="true">
              +
            </span>
            <strong>{selectedFile ? selectedFile.name : "Upload PDF"}</strong>
            <small>
              {selectedFile
                ? "Ready for analysis"
                : "Drop a document or browse"}
            </small>
          </label>
          <input
            id="pdf-upload"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        {uploadMessage && <div className="status-banner">{uploadMessage}</div>}
        {error && <div className="error-banner">{error}</div>}

        <nav className="primary-nav" aria-label="Primary navigation">
          <button
            className={currentView === "overview" ? "active" : ""}
            type="button"
            onClick={() => navigateTo("overview")}
          >
            <span>◈</span> Overview
          </button>
          <button
            className={currentView === "documents" ? "active" : ""}
            type="button"
            onClick={() => navigateTo("documents")}
          >
            <span>▤</span> Documents
          </button>
          <button
            className={currentView === "actions" ? "active" : ""}
            type="button"
            onClick={() => navigateTo("actions")}
          >
            <span>→</span> Action queue
          </button>
        </nav>

        <div className="docs-list">
          <div className="list-heading">
            <div>
              <p className="sidebar-kicker">Workspace</p>
              <h2>Documents</h2>
            </div>
            <span className="document-count">{documents.length}</span>
          </div>
          {isLoadingDocuments ? (
            <div className="loading-state">
              <span /> Loading workspace...
            </div>
          ) : documents.length === 0 ? (
            <div className="sidebar-empty">
              <span aria-hidden="true">✦</span>
              <p>Your document workspace is ready.</p>
            </div>
          ) : (
            documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={`doc-card ${selectedDocumentId === doc.id ? "active" : ""}`}
                onClick={() => setSelectedDocumentId(doc.id)}
              >
                <div className="doc-row">
                  <strong>{doc.original_filename}</strong>
                  <span
                    className={`pill ${doc.analysis_status === "complete" ? "complete" : "pending"}`}
                  >
                    {doc.analysis_status || "pending"}
                  </span>
                </div>
                <small>{new Date(doc.created_at).toLocaleDateString()}</small>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className={`content-panel page-${currentView}`}>
        <header className="topbar">
          <div>
            <p className="eyebrow">Document intelligence / {currentView}</p>
            <h2>
              {currentView === "overview"
                ? "Your intelligence workspace"
                : currentView === "actions"
                  ? "Turn insight into action"
                  : activeDocument
                    ? activeDocument.original_filename
                    : "No document selected"}
            </h2>
          </div>
          <div
            className={`live-pill ${geminiStatus.gemini_configured ? "ready" : "waiting"}`}
          >
            <span className="live-dot" aria-hidden="true" />
            {geminiStatus.gemini_configured ? "AI Ready" : "Needs Gemini Key"}
          </div>
          {documentDetail && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleAnalyze(documentDetail.id)}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? "Analyzing..." : "Retry Analysis"}
            </button>
          )}
        </header>

        <section className="stats-grid">
          <div className="stat-card stat-blue">
            <div className="stat-topline">
              <span>Total Documents</span>
              <span className="stat-index">01</span>
            </div>
            <strong>{stats.totalDocuments}</strong>
            <span className="stat-note">Across your workspace</span>
          </div>
          <div className="stat-card stat-amber">
            <div className="stat-topline">
              <span>Pending Actions</span>
              <span className="stat-index">02</span>
            </div>
            <strong>{stats.pendingActions}</strong>
            <span className="stat-note">Ready for attention</span>
          </div>
          <div className="stat-card stat-red">
            <div className="stat-topline">
              <span>High Priority Risks</span>
              <span className="stat-index">03</span>
            </div>
            <strong>{stats.highPriorityRisks}</strong>
            <span className="stat-note">Flagged by analysis</span>
          </div>
          <div className="stat-card stat-green">
            <div className="stat-topline">
              <span>Upcoming Deadlines</span>
              <span className="stat-index">04</span>
            </div>
            <strong>{stats.upcomingDeadlines}</strong>
            <span className="stat-note">Extracted from documents</span>
          </div>
        </section>

        <section className="overview-panel">
          <div className="overview-intro">
            <div>
              <div className="overview-card-label">
                <span>DOCUFLOW / DAILY BRIEF</span>
                <b>LIVE</b>
              </div>
              <p className="eyebrow">Workspace pulse</p>
              <h3>See what needs your attention.</h3>
              <p>
                DocuFlow transforms dense documents into a calm, prioritized
                view of what matters next.
              </p>
              <div className="overview-meta-row">
                <span>
                  <i aria-hidden="true" /> Live workspace
                </span>
                <span>
                  <i aria-hidden="true" /> Gemini connected
                </span>
                <span>
                  <i aria-hidden="true" /> Action-ready
                </span>
              </div>
            </div>
            <button
              type="button"
              className="overview-cta"
              onClick={() => navigateTo("documents")}
            >
              Open document intelligence <span>↗</span>
            </button>
          </div>
          <div className="overview-columns">
            <div className="overview-feature feature-coral">
              <span>01 / INSIGHT</span>
              <strong>
                {stats.highPriorityRisks
                  ? `${stats.highPriorityRisks} risk${stats.highPriorityRisks > 1 ? "s" : ""} need review`
                  : "No critical risks found"}
              </strong>
              <small>Risk signals from your active document</small>
            </div>
            <div className="overview-feature feature-mint">
              <span>02 / MOMENTUM</span>
              <strong>
                {stats.pendingActions
                  ? `${stats.pendingActions} action${stats.pendingActions > 1 ? "s" : ""} waiting`
                  : "Your queue is clear"}
              </strong>
              <small>Keep work moving from the action queue</small>
            </div>
            <div className="overview-feature feature-ink">
              <span>03 / WORKSPACE</span>
              <strong>
                {documents.length
                  ? `${documents.length} document${documents.length > 1 ? "s" : ""} indexed`
                  : "Start your workspace"}
              </strong>
              <small>Every upload becomes searchable intelligence</small>
            </div>
          </div>
        </section>

        <section className="actions-panel">
          <div className="page-heading-row">
            <div>
              <p className="eyebrow">Execution queue</p>
              <h3>Actions that move work forward.</h3>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigateTo("documents")}
            >
              View source document
            </button>
          </div>
          <div className="progress-strip">
            <div className="progress-copy">
              <span>Requirements momentum</span>
              <strong>
                {actionProgress.completed}/{actionProgress.total || 0} complete
              </strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${actionProgress.percentage}%` }} />
            </div>
            <small>
              {actionProgress.percentage === 100 && actionProgress.total
                ? "All requirements achieved. Risk exposure is reduced."
                : `${actionProgress.percentage}% complete. Keep moving to close the loop.`}
            </small>
          </div>
          {actionFeedback && (
            <div className="action-feedback" role="status">
              <span aria-hidden="true">✓</span>
              {actionFeedback}
            </div>
          )}
          {!documentDetail || !documentDetail.actions?.length ? (
            <EmptyPanel
              icon="→"
              title="Your action queue is quiet"
              message="Analyze a document to turn obligations into clear next steps."
            />
          ) : (
            <div className="action-board">
              {documentDetail.actions.map((item) => (
                <div
                  key={item.id}
                  className={`action-board-item ${item.status === "Completed" ? "is-completed" : ""} ${updatingActionId === item.id ? "is-updating" : ""}`}
                >
                  <div className="action-board-number">
                    {String(item.id).padStart(2, "0")}
                  </div>
                  <div className="action-board-copy">
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <small>From {documentDetail.original_filename}</small>
                  </div>
                  <div className="action-board-control">
                    <StatusVisual
                      status={item.status}
                      isUpdating={updatingActionId === item.id}
                    />
                    <span
                      className={`priority ${item.priority?.toLowerCase() || "medium"}`}
                    >
                      {item.priority || "Medium"}
                    </span>
                    {item.status === "Completed" ? (
                      <span className="completed-state">
                        <span aria-hidden="true">✓</span> Complete
                      </span>
                    ) : (
                      <StatusSelect
                        value={item.status}
                        options={statusOptions}
                        onChange={(nextStatus) =>
                          handleStatusChange(item.id, nextStatus)
                        }
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {documentDetail && (
          <section className="document-hero">
            <div className="document-seal" aria-hidden="true">
              PDF
            </div>
            <div className="document-hero-copy">
              <p className="eyebrow">Active intelligence brief</p>
              <h3>{documentDetail.original_filename}</h3>
              <p>
                {documentDetail.analysis?.document_type ||
                  "Document awaiting classification"}
                <span className="hero-divider">/</span>
                {documentDetail.extracted_text
                  ? `${documentDetail.extracted_text.length.toLocaleString()} characters indexed`
                  : "Text not indexed"}
              </p>
            </div>
            <div className="document-signal">
              <span className="signal-ring" aria-hidden="true" />
              <div>
                <strong>
                  {documentDetail.analysis
                    ? "Synthesis complete"
                    : "Ready to synthesize"}
                </strong>
                <small>
                  {documentDetail.analysis
                    ? "Signals mapped from this document"
                    : "Run analysis to reveal document signals"}
                </small>
              </div>
            </div>
          </section>
        )}

        {documentDetail && (
          <div
            className="signal-ribbon"
            aria-label="Document processing signals"
          >
            <span className="signal-label">Live signals</span>
            <span className="signal-chip">
              <i className="signal-check" aria-hidden="true">
                ✓
              </i>{" "}
              Text indexed
            </span>
            <span className="signal-chip">
              <i className="signal-check" aria-hidden="true">
                ✓
              </i>{" "}
              Structure mapped
            </span>
            <span
              className={`signal-chip ${documentDetail.analysis ? "active" : "muted"}`}
            >
              <i className="signal-pulse" aria-hidden="true" />{" "}
              {documentDetail.analysis ? "Insights ready" : "Awaiting analysis"}
            </span>
            <span className="signal-trace" aria-hidden="true" />
          </div>
        )}

        {!documentDetail ? (
          <div className="empty-state">
            <div className="empty-hero-mark" aria-hidden="true">
              ✦
            </div>
            <p className="eyebrow">Your workspace is ready</p>
            <h3>Turn paperwork into momentum.</h3>
            <p>
              Upload a PDF and DocuFlow will surface the decisions, deadlines,
              and next steps hiding inside it.
            </p>
            <label className="empty-action" htmlFor="pdf-upload">
              Choose a document <span aria-hidden="true">→</span>
            </label>
          </div>
        ) : (
          <div className="detail-stack">
            <section className="analysis-card summary-card">
              <div className="section-kicker">Executive read</div>
              <h3>Summary</h3>
              <p>
                {documentDetail.analysis?.summary ||
                  "No summary available yet."}
              </p>
            </section>

            <div className="two-columns">
              <section className="analysis-card type-card">
                <div className="section-kicker">Classification</div>
                <h3>Document Type</h3>
                <p>
                  {documentDetail.analysis?.document_type || "Not identified"}
                </p>
              </section>
              <section className="analysis-card key-points-card">
                <div className="section-kicker">Signal extraction</div>
                <h3>Key Points</h3>
                {(documentDetail.analysis?.key_points || []).length === 0 ? (
                  <EmptyPanel
                    icon="✦"
                    title="No key points yet"
                    message="Important takeaways will appear here after analysis."
                  />
                ) : (
                  <ul>
                    {(documentDetail.analysis?.key_points || []).map(
                      (point, index) => (
                        <li key={`${point}-${index}`}>{point}</li>
                      ),
                    )}
                  </ul>
                )}
              </section>
            </div>

            <div className="two-columns">
              <section className="analysis-card responsibilities-card">
                <div className="section-kicker">Ownership map</div>
                <h3>Responsibilities</h3>
                {(documentDetail.analysis?.responsibilities || []).length ===
                0 ? (
                  <EmptyPanel
                    icon="◎"
                    title="No owners identified"
                    message="Assigned responsibilities will be grouped here."
                  />
                ) : (
                  <ul>
                    {(documentDetail.analysis?.responsibilities || []).map(
                      (item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ),
                    )}
                  </ul>
                )}
              </section>
              <section className="analysis-card rules-card">
                <div className="section-kicker">Operating logic</div>
                <h3>Rules</h3>
                {(documentDetail.analysis?.rules || []).length === 0 ? (
                  <EmptyPanel
                    icon="≡"
                    title="No rules detected"
                    message="Document policies and constraints will appear here."
                  />
                ) : (
                  <ul>
                    {(documentDetail.analysis?.rules || []).map(
                      (item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ),
                    )}
                  </ul>
                )}
              </section>
            </div>

            <div className="two-columns">
              <section className="analysis-card deadlines-card">
                <div className="section-kicker">Time horizon</div>
                <h3>Deadlines</h3>
                {(documentDetail.analysis?.deadlines || []).length === 0 ? (
                  <EmptyPanel
                    icon="◷"
                    title="Clear calendar"
                    message="No deadlines were identified in this document."
                  />
                ) : (
                  <ul>
                    {(documentDetail.analysis?.deadlines || []).map(
                      (item, index) => (
                        <li key={`${item.title}-${index}`}>
                          <strong>{item.date || "Date not specified"}</strong>
                          <div>{item.title}</div>
                          <small>{item.description}</small>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </section>

              <section className="analysis-card risks-card">
                <div className="section-kicker">Attention required</div>
                <h3>Risks</h3>
                {(documentDetail.analysis?.risks || []).length === 0 ? (
                  <EmptyPanel
                    icon="✓"
                    title="No risks detected"
                    message="Nothing needs escalation from this document."
                  />
                ) : (
                  <ul>
                    {(documentDetail.analysis?.risks || []).map(
                      (item, index) => (
                        <li key={`${item.title}-${index}`}>
                          <span
                            className={`severity ${item.severity?.toLowerCase() || "medium"}`}
                          >
                            {item.severity || "Medium"}
                          </span>
                          <strong>{item.title}</strong>
                          <div>{item.description}</div>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </section>
            </div>

            <section className="analysis-card actions-card">
              <div className="section-header">
                <div>
                  <div className="section-kicker">Execution queue</div>
                  <h3>Actions</h3>
                </div>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => setDocumentPendingDelete(documentDetail)}
                >
                  <span className="delete-icon" aria-hidden="true" /> Delete
                </button>
              </div>
              <div className="progress-strip document-progress">
                <div className="progress-copy">
                  <span>Requirement completion</span>
                  <strong>
                    {actionProgress.completed}/{actionProgress.total || 0}
                  </strong>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${actionProgress.percentage}%` }} />
                </div>
              </div>
              {actionFeedback && (
                <div className="action-feedback" role="status">
                  <span aria-hidden="true">✓</span>
                  {actionFeedback}
                </div>
              )}
              {(documentDetail.actions || []).length === 0 ? (
                <EmptyPanel
                  icon="→"
                  title="No action items yet"
                  message="Once analysis finds follow-ups, they will become trackable tasks here."
                />
              ) : (
                <div className="action-list">
                  {documentDetail.actions.map((item) => (
                    <div
                      key={item.id}
                      className={`action-item ${item.status === "Completed" ? "is-completed" : ""} ${updatingActionId === item.id ? "is-updating" : ""}`}
                    >
                      <div className="action-head">
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                        </div>
                        <div className="action-meta">
                          <StatusVisual
                            status={item.status}
                            isUpdating={updatingActionId === item.id}
                          />
                          <span
                            className={`priority ${item.priority?.toLowerCase() || "medium"}`}
                          >
                            {item.priority || "Medium"}
                          </span>
                          <span>{item.deadline || "No deadline"}</span>
                        </div>
                      </div>

                      <div className="action-footer">
                        {item.status === "Completed" ? (
                          <span className="completed-state">
                            <span aria-hidden="true">✓</span> Requirement
                            complete
                          </span>
                        ) : (
                          <StatusSelect
                            value={item.status}
                            options={statusOptions}
                            onChange={(nextStatus) =>
                              handleStatusChange(item.id, nextStatus)
                            }
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {documentPendingDelete && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting)
              setDocumentPendingDelete(null);
          }}
        >
          <section
            className={`confirm-dialog ${isDeleting ? "is-deleting" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="dialog-icon" aria-hidden="true">
              <span className="delete-icon" />
              <span className="delete-spark" />
            </div>
            <p className="eyebrow">Permanent action</p>
            <h2 id="delete-title">Delete this document?</h2>
            <p className="dialog-copy">
              This will remove{" "}
              <strong>{documentPendingDelete.original_filename}</strong>, its
              analysis, and its action items from your workspace.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setDocumentPendingDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-delete-button"
                onClick={() => handleDelete(documentPendingDelete.id)}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
