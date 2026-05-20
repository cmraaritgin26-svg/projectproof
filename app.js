const STORAGE_KEY = "projectProof.projects.v1";
const BUSINESS_KEY = "projectProof.business.v1";
const DEFAULT_OCR_ENDPOINT = "https://projectproof-ocr.onrender.com/ocr/receipt";
const STAGES = ["before", "progress", "after"];

const projectList = document.querySelector("#projectList");
const projectDetail = document.querySelector("#projectDetail");
const newProjectButton = document.querySelector("#newProjectButton");
const projectDialog = document.querySelector("#projectDialog");
const projectForm = document.querySelector("#projectForm");
const projectName = document.querySelector("#projectName");
const projectClient = document.querySelector("#projectClient");
const projectType = document.querySelector("#projectType");
const heroNewButton = document.querySelector(".hero-new-button");
const closeProjectDialog = document.querySelector("#closeProjectDialog");

let projects = loadProjects();
let businessProfile = loadBusinessProfile();
let activeProjectId = projects[0]?.id || "";

seedDemoProject();
hydrateDemoAssets();
render();

newProjectButton.addEventListener("click", () => {
  openProjectDialog();
});

heroNewButton?.addEventListener("click", () => {
  openProjectDialog();
});

closeProjectDialog?.addEventListener("click", () => {
  projectDialog.close();
});

function openProjectDialog() {
  projectForm.reset();
  projectDialog.showModal();
  projectName.focus();
}

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = projectName.value.trim();
  if (!name) return;
  const project = createProject({
    name,
    client: projectClient.value.trim(),
    type: projectType.value
  });
  projects.unshift(project);
  activeProjectId = project.id;
  saveProjects();
  projectDialog.close();
  render();
});

projectList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-project-id]");
  if (!button) return;
  activeProjectId = button.dataset.projectId;
  render();
  document.querySelector("#recordEditor")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

projectDetail.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const project = getActiveProject();
  if (!project) return;
  const action = button.dataset.action;

  if (action === "delete-project") {
    projects = projects.filter((item) => item.id !== project.id);
    activeProjectId = projects[0]?.id || "";
  }

  if (action === "complete-project") {
    project.status = project.status === "complete" ? "active" : "complete";
  }

  if (action === "save-project-info") {
    const name = document.querySelector("#projectNameEdit").value.trim();
    if (name) project.name = name;
    project.client = document.querySelector("#projectClientEdit").value.trim();
    project.type = document.querySelector("#projectTypeEdit").value;
  }

  if (action === "save-business-profile") {
    businessProfile = {
      name: document.querySelector("#businessNameInput").value.trim(),
      email: document.querySelector("#businessEmailInput").value.trim(),
      phone: document.querySelector("#businessPhoneInput").value.trim(),
      ocrEndpoint: document.querySelector("#ocrEndpointInput").value.trim()
    };
    saveBusinessProfile();
  }

  if (action === "add-check") {
    const input = document.querySelector("#checkInput");
    const text = input.value.trim();
    if (text) project.checklist.push({ id: makeId(), text, done: false });
    input.value = "";
  }

  if (action === "add-material") {
    const name = document.querySelector("#materialName").value.trim();
    const cost = Number(document.querySelector("#materialCost").value) || 0;
    if (name) project.materials.push({ id: makeId(), name, cost });
    document.querySelector("#materialName").value = "";
    document.querySelector("#materialCost").value = "";
  }

  if (action === "add-receipt-material") {
    const name = document.querySelector("#receiptVendorInput").value.trim();
    const cost = Number(document.querySelector("#receiptTotalInput").value) || 0;
    if (name) {
      project.materials.push({ id: makeId(), name, cost });
      project.receiptVendor = "";
      project.receiptTotal = "";
      project.receiptDraft = "";
    }
  }

  if (action === "read-receipt") {
    await readReceiptWithOcr(project);
  }

  if (action === "add-hours") {
    const hours = Number(document.querySelector("#hoursInput").value) || 0;
    if (hours > 0) project.hours = Math.round((Number(project.hours) + hours) * 100) / 100;
    document.querySelector("#hoursInput").value = "";
  }

  if (action === "save-notes") {
    project.notes = document.querySelector("#notesInput").value.trim();
  }

  if (action === "generate-ai") {
    project.aiDraft = buildAiDraft(project);
  }

  if (action === "use-ai-notes") {
    project.notes = buildAiNote(project);
    project.aiDraft = buildAiDraft(project);
  }

  if (action === "copy-report") {
    await copyReport(project);
    saveProjects();
    render();
    return;
  }

  if (action === "copy-client-portal") {
    await copyClientPortal(project);
    saveProjects();
    render();
    return;
  }

  if (action === "create-invoice") {
    await createInvoicePdf(project);
    return;
  }

  if (action === "email-invoice") {
    await emailInvoice(project);
    return;
  }

  saveProjects();
  render();
});

projectDetail.addEventListener("change", async (event) => {
  const project = getActiveProject();
  if (!project) return;

  const checkbox = event.target.closest("input[data-check-id]");
  if (checkbox) {
    const item = project.checklist.find((entry) => entry.id === checkbox.dataset.checkId);
    if (item) item.done = checkbox.checked;
    saveProjects();
    render();
    return;
  }

  const photoInput = event.target.closest("input[data-photo-stage]");
  if (photoInput && photoInput.files?.[0]) {
    const stage = photoInput.dataset.photoStage;
    project.photos[stage] = await fileToDataUrl(photoInput.files[0]);
    saveProjects();
    render();
  }

  const receiptInput = event.target.closest("input[data-receipt-input]");
  if (receiptInput && receiptInput.files?.[0]) {
    const file = receiptInput.files[0];
    project.receiptPhoto = await fileToDataUrl(file);
    project.receiptDraft = `Receipt captured: ${file.name.replace(/\.[^.]+$/, "")}`;
    saveProjects();
    render();
  }
});

function loadProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadBusinessProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BUSINESS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function saveBusinessProfile() {
  localStorage.setItem(BUSINESS_KEY, JSON.stringify(businessProfile));
}

function seedDemoProject() {
  if (projects.length) return;
  projects = [
    {
      ...createProject({ name: "Back patio cleanup", client: "Maple Street", type: "Landscaping" }),
      hours: 3.5,
      materials: [
        { id: makeId(), name: "Mulch bags", cost: 32 },
        { id: makeId(), name: "Edging stakes", cost: 18 }
      ],
      photos: getDemoPhotos(),
      checklist: [
        { id: makeId(), text: "Before photos captured", done: true },
        { id: makeId(), text: "Debris removed", done: true },
        { id: makeId(), text: "Final after photos", done: false }
      ],
      notes: "Client asked for a simple cleanup with proof photos before invoice."
    }
  ];
  activeProjectId = projects[0].id;
  saveProjects();
}

function hydrateDemoAssets() {
  let changed = false;
  projects.forEach((project) => {
    if (project.name !== "Back patio cleanup") return;
    const demoPhotos = getDemoPhotos();
    project.photos = project.photos || {};
    STAGES.forEach((stage) => {
      if (!project.photos[stage] || String(project.photos[stage]).endsWith(`proof-${stage}.svg`)) {
        project.photos[stage] = demoPhotos[stage];
        changed = true;
      }
    });
  });
  if (changed) saveProjects();
}

function getDemoPhotos() {
  return {
    before: "assets/proof-before-real.png",
    progress: "assets/proof-progress-real.png",
    after: "assets/proof-after-real.png"
  };
}

function createProject({ name, client, type }) {
  return {
    id: makeId(),
    name,
    client,
    type,
    status: "active",
    createdAt: new Date().toISOString(),
    hours: 0,
    photos: { before: "", progress: "", after: "" },
    checklist: [
      { id: makeId(), text: "Capture before photo", done: false },
      { id: makeId(), text: "Add work notes", done: false },
      { id: makeId(), text: "Capture after photo", done: false }
    ],
    materials: [],
    receiptPhoto: "",
    receiptDraft: "",
    receiptVendor: "",
    receiptTotal: "",
    notes: "",
    aiDraft: ""
  };
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function getActiveProject() {
  return projects.find((project) => project.id === activeProjectId) || projects[0] || null;
}

function render() {
  renderSummary();
  renderProjectList();
  renderProjectDetail();
}

function renderSummary() {
  const active = projects.filter((project) => project.status !== "complete").length;
  const photos = projects.reduce((sum, project) => sum + STAGES.filter((stage) => project.photos?.[stage]).length, 0);
  const hours = projects.reduce((sum, project) => sum + Number(project.hours || 0), 0);
  const materials = projects.reduce((sum, project) => sum + getMaterialsTotal(project), 0);

  document.querySelector("#activeJobs").textContent = String(active);
  document.querySelector("#photoCount").textContent = String(photos);
  document.querySelector("#hoursCount").textContent = formatNumber(hours);
  document.querySelector("#materialsTotal").textContent = formatMoney(materials);
}

function renderProjectList() {
  if (!projects.length) {
    projectList.innerHTML = `<div class="empty-state"><p>No projects yet.</p></div>`;
    return;
  }
  projectList.innerHTML = projects.map((project) => `
    <button class="project-button ${project.id === activeProjectId ? "active" : ""}" data-project-id="${escapeHtml(project.id)}" type="button">
      <strong>${escapeHtml(project.name)}</strong>
      <span>${escapeHtml(project.client || "No client")} · ${escapeHtml(project.type)} · ${project.status === "complete" ? "Complete" : "Active"}</span>
    </button>
  `).join("");
}

function renderProjectDetail() {
  const project = getActiveProject();
  if (!project) {
    projectDetail.innerHTML = `
      <div class="empty-state">
        <img src="assets/icon.svg" alt="">
        <h2>Create your first project</h2>
        <p>Create before-after proof reports with photos, hours, materials, checklist items, and AI-written client handoff copy.</p>
      </div>
    `;
    return;
  }

  projectDetail.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">${escapeHtml(project.type)}</p>
        <h2>${escapeHtml(project.name)}</h2>
      </div>
      <div class="detail-actions">
        <button class="secondary-button" data-action="copy-report" type="button">Copy client report</button>
        <button class="secondary-button" data-action="create-invoice" type="button">Create PDF invoice</button>
        ${project.status === "complete" ? `<button class="primary-button" data-action="email-invoice" type="button">Email invoice</button>` : ""}
        <button class="primary-button" data-action="complete-project" type="button">${project.status === "complete" ? "Reopen" : "Mark complete"}</button>
        <button class="danger-button" data-action="delete-project" type="button">Delete</button>
      </div>
    </div>
    <div class="meta-strip">
      <span>${escapeHtml(project.client || "No client/location")}</span>
      <span>${formatNumber(project.hours)} hours</span>
      <span>${formatMoney(getMaterialsTotal(project))} materials</span>
      <span>${getCompletedChecks(project)}/${project.checklist.length} checklist</span>
    </div>
    <section class="panel-box record-edit-panel" id="recordEditor">
      <div class="section-head">
        <div>
          <p class="eyebrow">Work record</p>
          <h3>Edit information</h3>
        </div>
        <button class="secondary-button" data-action="save-project-info" type="button">Save changes</button>
      </div>
      <div class="record-edit-form">
        <label>
          <span>Project name</span>
          <input id="projectNameEdit" type="text" value="${escapeHtml(project.name)}">
        </label>
        <label>
          <span>Client or location</span>
          <input id="projectClientEdit" type="text" value="${escapeHtml(project.client || "")}" placeholder="Client, address, or job site">
        </label>
        <label>
          <span>Job type</span>
          <select id="projectTypeEdit">${renderTypeOptions(project.type)}</select>
        </label>
      </div>
    </section>
    <div class="photo-grid">
      ${STAGES.map((stage) => renderPhotoCard(project, stage)).join("")}
    </div>
    <div class="two-column">
      <section class="panel-box">
        <div class="section-head">
          <div>
          <p class="eyebrow">Proof checklist</p>
          <h3>Closeout steps</h3>
          </div>
        </div>
        <div class="stack">
          ${project.checklist.map(renderCheckRow).join("")}
        </div>
        <div class="quick-form">
          <input id="checkInput" type="text" placeholder="Add checklist item">
          <button class="secondary-button" data-action="add-check" type="button">Add</button>
        </div>
      </section>
      <section class="panel-box">
        <div class="section-head">
          <div>
          <p class="eyebrow">Invoice support</p>
          <h3>Costs and hours</h3>
          </div>
        </div>
        <div class="stack">
          ${project.materials.length ? project.materials.map(renderMaterialRow).join("") : `<p class="muted">No materials logged.</p>`}
        </div>
        <div class="quick-form material-form">
          <input id="materialName" type="text" placeholder="Material">
          <input id="materialCost" type="number" min="0" step="0.01" placeholder="Cost">
          <button class="secondary-button" data-action="add-material" type="button">Add</button>
        </div>
        <div class="quick-form">
          <input id="hoursInput" type="number" min="0" step="0.25" placeholder="Add hours">
          <button class="secondary-button" data-action="add-hours" type="button">Log</button>
        </div>
      </section>
    </div>
    <section class="market-tools">
      <section class="panel-box business-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Paid branding</p>
            <h3>Business profile</h3>
          </div>
          <button class="secondary-button" data-action="save-business-profile" type="button">Save</button>
        </div>
        <div class="business-form">
          <label>
            <span>Business name</span>
            <input id="businessNameInput" type="text" value="${escapeHtml(businessProfile.name || "")}" placeholder="Your business name">
          </label>
          <label>
            <span>Email</span>
            <input id="businessEmailInput" type="email" value="${escapeHtml(businessProfile.email || "")}" placeholder="you@example.com">
          </label>
          <label>
            <span>Phone</span>
            <input id="businessPhoneInput" type="tel" value="${escapeHtml(businessProfile.phone || "")}" placeholder="Phone number">
          </label>
          <label>
            <span>OCR backend</span>
            <input id="ocrEndpointInput" type="url" value="${escapeHtml(businessProfile.ocrEndpoint || DEFAULT_OCR_ENDPOINT)}" placeholder="https://projectproof-ocr.onrender.com/ocr/receipt">
          </label>
        </div>
        <p class="feature-note">Saved business info appears at the top of generated invoices.</p>
      </section>
      <section class="panel-box receipt-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Receipt scanner</p>
            <h3>Materials capture</h3>
          </div>
          <label class="stage-button compact-stage-button">
            Scan
            <input data-receipt-input type="file" accept="image/*" capture="environment" hidden>
          </label>
        </div>
        <div class="receipt-body">
          <div class="receipt-frame">
            ${project.receiptPhoto ? `<img src="${project.receiptPhoto}" alt="Receipt photo">` : `<span>Receipt image</span>`}
          </div>
          <div class="receipt-fields">
            <p class="feature-note">${escapeHtml(project.receiptDraft || "Backend OCR can read this image later. For now, enter the vendor and total to add it to materials.")}</p>
            <label>
              <span>Vendor / item</span>
              <input id="receiptVendorInput" type="text" value="${escapeHtml(project.receiptVendor || "")}" placeholder="Receipt vendor or material">
            </label>
            <label>
              <span>Total</span>
              <input id="receiptTotalInput" type="number" min="0" step="0.01" value="${escapeHtml(project.receiptTotal || "")}" placeholder="0.00">
            </label>
            <button class="primary-button" data-action="read-receipt" type="button">Read receipt</button>
            <button class="secondary-button" data-action="add-receipt-material" type="button">Add to costs</button>
          </div>
        </div>
      </section>
      <section class="panel-box portal-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Client portal</p>
            <h3>Share packet</h3>
          </div>
          <button class="secondary-button" data-action="copy-client-portal" type="button">Copy</button>
        </div>
        <p class="feature-note">Creates a clean client-ready packet with status, photos, notes, hours, costs, and handoff language. A hosted portal can replace this copy once your backend is live.</p>
        <pre class="portal-preview">${escapeHtml(buildClientPortalPacket(project))}</pre>
      </section>
    </section>
    <section class="ai-panel">
      <div class="ai-orb" aria-hidden="true">AI</div>
      <div class="ai-heading">
        <p class="eyebrow">ProjectProof AI</p>
        <h3>Client report writer</h3>
        <p>Turn photos, costs, hours, and checklist status into professional wording for invoices, text messages, and follow-up emails.</p>
      </div>
      <div class="ai-actions">
        <button class="primary-button" data-action="generate-ai" type="button">Write report</button>
        <button class="secondary-button" data-action="use-ai-notes" type="button">Use as notes</button>
      </div>
      <pre class="ai-output">${escapeHtml(project.aiDraft || buildAiDraft(project))}</pre>
    </section>
    <section class="panel-box notes-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Client handoff</p>
          <h3>Notes and report</h3>
        </div>
        <button class="secondary-button" data-action="save-notes" type="button">Save notes</button>
      </div>
      <textarea id="notesInput" placeholder="Work performed, client requests, issues found, next steps">${escapeHtml(project.notes)}</textarea>
      <pre class="report-preview">${escapeHtml(buildReport(project))}</pre>
    </section>
  `;
}

function renderPhotoCard(project, stage) {
  const label = stage[0].toUpperCase() + stage.slice(1);
  const photo = project.photos?.[stage];
  return `
    <article class="photo-card">
      <div>
        <p class="eyebrow">${escapeHtml(label)}</p>
        <h3>${escapeHtml(label)} photo</h3>
      </div>
      <div class="photo-frame">
        ${photo ? `<img src="${photo}" alt="${escapeHtml(label)} project photo">` : `<div class="photo-placeholder">${escapeHtml(label)} photo empty</div>`}
      </div>
      <div class="photo-actions">
        <label class="stage-button">
          Add photo
          <input data-photo-stage="${escapeHtml(stage)}" type="file" accept="image/*" capture="environment" hidden>
        </label>
      </div>
    </article>
  `;
}

function renderTypeOptions(selectedType) {
  const types = ["Landscaping", "Cleaning", "Painting", "Handyman", "Repair", "Inspection", "Other"];
  return types.map((type) => `<option ${type === selectedType ? "selected" : ""}>${escapeHtml(type)}</option>`).join("");
}

function renderCheckRow(item) {
  return `
    <label class="check-row ${item.done ? "done" : ""}">
      <input data-check-id="${escapeHtml(item.id)}" type="checkbox" ${item.done ? "checked" : ""}>
      <span>${escapeHtml(item.text)}</span>
    </label>
  `;
}

function renderMaterialRow(item) {
  return `
    <div class="material-row">
      <span>${escapeHtml(item.name)}</span>
      <strong>${formatMoney(item.cost)}</strong>
    </div>
  `;
}

function getCompletedChecks(project) {
  return project.checklist.filter((item) => item.done).length;
}

function getMaterialsTotal(project) {
  return project.materials.reduce((sum, item) => sum + Number(item.cost || 0), 0);
}

function buildReport(project) {
  const checks = project.checklist.map((item) => `${item.done ? "[x]" : "[ ]"} ${item.text}`).join("\n");
  const materials = project.materials.length
    ? project.materials.map((item) => `- ${item.name}: ${formatMoney(item.cost)}`).join("\n")
    : "- None logged";
  return `${project.name}
${project.client ? `Client/location: ${project.client}` : "Client/location: Not set"}
Type: ${project.type}
Status: ${project.status}
Hours: ${formatNumber(project.hours)}
Materials: ${formatMoney(getMaterialsTotal(project))}
Photos: ${STAGES.filter((stage) => project.photos?.[stage]).length}/3

Checklist:
${checks}

Materials:
${materials}

Notes:
${project.notes || "No notes added."}`;
}

function buildClientPortalPacket(project) {
  const photos = STAGES.filter((stage) => project.photos?.[stage]).map((stage) => stage[0].toUpperCase() + stage.slice(1));
  const businessLine = businessProfile.name ? `${businessProfile.name}\n` : "";
  return `${businessLine}${project.name}
Client/location: ${project.client || "Not set"}
Status: ${project.status === "complete" ? "Complete" : "Active"}
Hours: ${formatNumber(project.hours)}
Costs: ${formatMoney(getMaterialsTotal(project))}
Photos attached: ${photos.length ? photos.join(", ") : "None yet"}

Client handoff:
${buildAiNote(project)}

Notes:
${project.notes || "No notes added."}`;
}

function buildAiDraft(project) {
  const photoCount = STAGES.filter((stage) => project.photos?.[stage]).length;
  const completed = getCompletedChecks(project);
  const remaining = project.checklist.filter((item) => !item.done).map((item) => item.text);
  const materialTotal = getMaterialsTotal(project);
  const statusLine = project.status === "complete"
    ? "The job is marked complete and ready for final review."
    : "The job is still active and should be reviewed before handoff.";
  const nextSteps = remaining.length
    ? remaining.slice(0, 4).map((item) => `- ${item}`).join("\n")
    : "- Capture or verify final after photo\n- Send report to client or save for records";

  return `Client-ready summary:
${project.name} is a ${project.type.toLowerCase()} job${project.client ? ` for ${project.client}` : ""}. ${statusLine} The record currently includes ${photoCount}/3 proof photo stages, ${formatNumber(project.hours)} logged hours, ${formatMoney(materialTotal)} in materials, and ${completed}/${project.checklist.length} checklist items completed.

Suggested next steps:
${nextSteps}

Report wording:
Work was documented with photo proof, project notes, checklist progress, and logged materials/hours. Final report should confirm the completed scope, any open follow-up items, and the before-after proof available for this job.`;
}

function buildAiNote(project) {
  const photoCount = STAGES.filter((stage) => project.photos?.[stage]).length;
  return `Work documented for ${project.name}. ${photoCount}/3 photo stages are attached. Logged ${formatNumber(project.hours)} hours and ${formatMoney(getMaterialsTotal(project))} in materials. Checklist progress is ${getCompletedChecks(project)}/${project.checklist.length}. Review open checklist items and capture final proof before closing the job.`;
}

async function readReceiptWithOcr(project) {
  if (!project.receiptPhoto) {
    project.receiptDraft = "Add a receipt image first.";
    return;
  }
  const endpoint = businessProfile.ocrEndpoint || DEFAULT_OCR_ENDPOINT;
  project.receiptDraft = "Reading receipt with OCR...";
  saveProjects();
  render();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: project.receiptPhoto })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Receipt OCR failed");
    project.receiptVendor = result.vendor || "";
    project.receiptTotal = result.total || "";
    project.receiptDraft = [
      result.vendor ? `Vendor: ${result.vendor}` : "",
      result.date ? `Date: ${result.date}` : "",
      result.total ? `Total: ${formatMoney(result.total)}` : "",
      `Confidence: ${Math.round(Number(result.confidence || 0) * 100)}%`
    ].filter(Boolean).join(" | ") || "OCR finished. Review the fields before adding to costs.";
  } catch (error) {
    project.receiptDraft = `OCR is not connected yet. ${String(error?.message || error)}`;
  }
}

async function createInvoicePdf(project) {
  const blob = await buildInvoicePdf(project);
  const filename = getInvoiceFilename(project);
  if (window.ProjectProofAndroid?.saveInvoice) {
    window.ProjectProofAndroid.saveInvoice(
      filename,
      await blobToBase64(blob),
      false,
      `Invoice - ${project.name}`,
      `ProjectProof invoice for ${project.name}`
    );
    return;
  }
  downloadBlob(blob, filename);
  window.alert?.("Invoice PDF created. Check your downloads.");
}

async function emailInvoice(project) {
  if (project.status !== "complete") {
    window.alert?.("Mark this job complete before emailing the invoice.");
    return;
  }

  const blob = await buildInvoicePdf(project);
  const filename = getInvoiceFilename(project);
  const subject = `Invoice - ${project.name}`;
  const body = `${buildReport(project)}\n\nAttached is the PDF invoice with proof photos.`;

  if (window.ProjectProofAndroid?.saveInvoice) {
    window.ProjectProofAndroid.saveInvoice(filename, await blobToBase64(blob), true, subject, body);
    return;
  }

  const file = new File([blob], filename, { type: "application/pdf" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: subject,
      text: body
    }).catch(() => {});
    return;
  }

  downloadBlob(blob, filename);
  openEmailDraft(project);
}

async function buildInvoicePdf(project) {
  const pages = await Promise.all([
    renderInvoiceSummaryPage(project),
    renderInvoiceDetailPage(project),
    renderInvoicePhotosPage(project)
  ]);
  const jpegBytes = pages.map((canvas) => dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.88)));
  return buildPdfFromJpegs(jpegBytes, pages[0].width, pages[0].height);
}

async function renderInvoiceSummaryPage(project) {
  const canvas = document.createElement("canvas");
  canvas.width = 1275;
  canvas.height = 1650;
  const ctx = canvas.getContext("2d");
  const margin = 86;
  const invoiceId = project.id.slice(0, 8).toUpperCase();
  const photos = STAGES.filter((stage) => project.photos?.[stage]).length;
  const completed = getCompletedChecks(project);
  const materialsTotal = getMaterialsTotal(project);

  fillPage(ctx, canvas);
  ctx.fillStyle = "#0a101b";
  ctx.fillRect(0, 0, canvas.width, 290);
  ctx.fillStyle = "#edf4ff";
  ctx.font = "800 54px sans-serif";
  ctx.fillText(businessProfile.name || "ProjectProof", margin, 104);
  ctx.font = "700 28px sans-serif";
  ctx.fillStyle = "#aeb9ca";
  ctx.fillText("Before-after proof invoice", margin, 150);
  const businessContact = [businessProfile.email, businessProfile.phone].filter(Boolean).join("  |  ");
  if (businessContact) {
    ctx.font = "700 22px sans-serif";
    ctx.fillText(businessContact, margin, 185);
  }
  ctx.textAlign = "right";
  ctx.font = "800 42px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("INVOICE", canvas.width - margin, 104);
  ctx.font = "700 24px sans-serif";
  ctx.fillStyle = "#aeb9ca";
  ctx.fillText(`#${invoiceId}`, canvas.width - margin, 145);
  ctx.fillText(formatDate(new Date()), canvas.width - margin, 180);
  ctx.textAlign = "left";

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, margin, 228, canvas.width - margin * 2, 168, 18);
  ctx.fill();
  drawLabelValue(ctx, "Project", project.name, margin + 32, 282);
  drawLabelValue(ctx, "Client / location", project.client || "Not set", margin + 32, 340);
  drawLabelValue(ctx, "Job type", project.type, canvas.width / 2 + 20, 282);
  drawLabelValue(ctx, "Status", project.status === "complete" ? "Complete" : "Active", canvas.width / 2 + 20, 340);

  const metricY = 450;
  drawMetric(ctx, "Hours", formatNumber(project.hours), margin, metricY);
  drawMetric(ctx, "Materials", formatMoney(materialsTotal), margin + 270, metricY);
  drawMetric(ctx, "Photos", `${photos}/3`, margin + 540, metricY);
  drawMetric(ctx, "Checklist", `${completed}/${project.checklist.length}`, margin + 810, metricY);

  let y = 690;
  drawSectionTitle(ctx, "Line Items", margin, y);
  y += 48;
  drawInvoiceRow(ctx, "Logged labor hours", `${formatNumber(project.hours)} hours`, "", margin, y, true);
  y += 56;
  if (project.materials.length) {
    project.materials.forEach((item) => {
      drawInvoiceRow(ctx, item.name, "Material", formatMoney(item.cost), margin, y);
      y += 48;
    });
  } else {
    drawInvoiceRow(ctx, "No materials logged", "Material", formatMoney(0), margin, y);
    y += 48;
  }
  y += 26;
  ctx.strokeStyle = "#d5dce8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(canvas.width - margin, y);
  ctx.stroke();
  y += 58;
  ctx.textAlign = "right";
  ctx.fillStyle = "#0a101b";
  ctx.font = "800 38px sans-serif";
  ctx.fillText(`Materials total: ${formatMoney(materialsTotal)}`, canvas.width - margin, y);
  ctx.textAlign = "left";

  y += 92;
  drawSectionTitle(ctx, "Checklist", margin, y);
  y += 45;
  project.checklist.slice(0, 6).forEach((item) => {
    ctx.fillStyle = item.done ? "#168f86" : "#7c8aa0";
    ctx.font = "800 24px sans-serif";
    ctx.fillText(item.done ? "DONE" : "OPEN", margin, y);
    ctx.fillStyle = "#263243";
    ctx.font = "600 24px sans-serif";
    drawWrappedText(ctx, item.text, margin + 84, y, canvas.width - margin * 2 - 84, 30, 1);
    y += 38;
  });

  y += 45;
  drawSectionTitle(ctx, "Notes", margin, y);
  y += 44;
  ctx.fillStyle = "#2c384a";
  ctx.font = "600 24px sans-serif";
  drawWrappedText(ctx, project.notes || "No notes added.", margin, y, canvas.width - margin * 2, 32, 5);

  drawFooter(ctx, canvas);
  return canvas;
}

function renderInvoiceDetailPage(project) {
  const canvas = document.createElement("canvas");
  canvas.width = 1275;
  canvas.height = 1650;
  const ctx = canvas.getContext("2d");
  const margin = 86;
  let y = 92;

  fillPage(ctx, canvas);
  drawSectionTitle(ctx, "Invoice Details", margin, y);
  y += 54;
  ctx.fillStyle = "#2c384a";
  ctx.font = "700 24px sans-serif";
  y = drawWrappedText(ctx, `${project.name} ${project.client ? `for ${project.client}` : ""}`, margin, y, canvas.width - margin * 2, 32, 2) + 24;

  drawSectionTitle(ctx, "Complete Checklist", margin, y);
  y += 44;
  project.checklist.forEach((item) => {
    ctx.fillStyle = item.done ? "#168f86" : "#7c8aa0";
    ctx.font = "800 22px sans-serif";
    ctx.fillText(item.done ? "DONE" : "OPEN", margin, y);
    ctx.fillStyle = "#263243";
    ctx.font = "600 23px sans-serif";
    drawWrappedText(ctx, item.text, margin + 84, y, canvas.width - margin * 2 - 84, 30, 2);
    y += 44;
  });

  y += 42;
  drawSectionTitle(ctx, "Client Notes", margin, y);
  y += 42;
  ctx.fillStyle = "#2c384a";
  ctx.font = "600 23px sans-serif";
  y = drawWrappedText(ctx, project.notes || "No notes added.", margin, y, canvas.width - margin * 2, 31, 8) + 56;

  drawSectionTitle(ctx, "Client Report Copy", margin, y);
  y += 42;
  ctx.fillStyle = "#2c384a";
  ctx.font = "600 22px sans-serif";
  drawWrappedText(ctx, buildReport(project), margin, y, canvas.width - margin * 2, 29, 18);

  drawFooter(ctx, canvas);
  return canvas;
}

async function renderInvoicePhotosPage(project) {
  const canvas = document.createElement("canvas");
  canvas.width = 1275;
  canvas.height = 1650;
  const ctx = canvas.getContext("2d");
  const margin = 72;
  const photoHeight = 355;

  fillPage(ctx, canvas);
  ctx.fillStyle = "#0a101b";
  ctx.fillRect(0, 0, canvas.width, 190);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 48px sans-serif";
  ctx.fillText("Proof Photos", margin, 90);
  ctx.fillStyle = "#aeb9ca";
  ctx.font = "700 24px sans-serif";
  ctx.fillText(project.name, margin, 132);

  let y = 250;
  for (const stage of STAGES) {
    const label = stage[0].toUpperCase() + stage.slice(1);
    drawSectionTitle(ctx, `${label} photo`, margin, y);
    y += 28;
    await drawPhoto(ctx, project.photos?.[stage], margin, y, canvas.width - margin * 2, photoHeight);
    y += photoHeight + 62;
  }

  drawFooter(ctx, canvas);
  return canvas;
}

function fillPage(ctx, canvas) {
  ctx.fillStyle = "#f7f9fc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawLabelValue(ctx, label, value, x, y) {
  ctx.fillStyle = "#697586";
  ctx.font = "800 20px sans-serif";
  ctx.fillText(label.toUpperCase(), x, y - 28);
  ctx.fillStyle = "#111827";
  ctx.font = "800 28px sans-serif";
  drawWrappedText(ctx, value, x, y, 470, 32, 1);
}

function drawMetric(ctx, label, value, x, y) {
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, 230, 140, 18);
  ctx.fill();
  ctx.fillStyle = "#697586";
  ctx.font = "800 20px sans-serif";
  ctx.fillText(label.toUpperCase(), x + 24, y + 42);
  ctx.fillStyle = "#0a101b";
  ctx.font = "900 42px sans-serif";
  ctx.fillText(value, x + 24, y + 96);
}

function drawSectionTitle(ctx, text, x, y) {
  ctx.fillStyle = "#0a101b";
  ctx.font = "900 30px sans-serif";
  ctx.fillText(text, x, y);
}

function drawInvoiceRow(ctx, name, detail, amount, x, y, muted = false) {
  ctx.fillStyle = muted ? "#697586" : "#182235";
  ctx.font = "700 24px sans-serif";
  ctx.fillText(name, x, y);
  ctx.fillStyle = "#697586";
  ctx.font = "600 21px sans-serif";
  ctx.fillText(detail, x + 520, y);
  ctx.textAlign = "right";
  ctx.fillStyle = "#182235";
  ctx.font = "800 24px sans-serif";
  ctx.fillText(amount, 1188, y);
  ctx.textAlign = "left";
}

async function drawPhoto(ctx, src, x, y, width, height) {
  ctx.fillStyle = "#e8eef6";
  roundRect(ctx, x, y, width, height, 22);
  ctx.fill();
  if (!src) {
    ctx.fillStyle = "#697586";
    ctx.font = "800 28px sans-serif";
    ctx.fillText("No photo attached", x + 40, y + height / 2);
    return;
  }
  try {
    const image = await loadImage(src);
    ctx.save();
    roundRect(ctx, x, y, width, height, 22);
    ctx.clip();
    drawImageCover(ctx, image, x, y, width, height);
    ctx.restore();
  } catch {
    ctx.fillStyle = "#697586";
    ctx.font = "800 28px sans-serif";
    ctx.fillText("Photo could not be loaded", x + 40, y + height / 2);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageCover(ctx, image, x, y, width, height) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      if (lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines += 1;
    } else {
      line = testLine;
    }
  });
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
  return y + Math.min(lines + 1, maxLines) * lineHeight;
}

function drawFooter(ctx, canvas) {
  ctx.fillStyle = "#697586";
  ctx.font = "700 20px sans-serif";
  ctx.fillText("Generated by ProjectProof", 86, canvas.height - 58);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function dataUrlToBytes(dataUrl) {
  const binary = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function buildPdfFromJpegs(images, width, height) {
  const chunks = [];
  const offsets = [0];
  let offset = 0;
  const encoder = new TextEncoder();
  const addString = (value) => {
    const bytes = encoder.encode(value);
    chunks.push(bytes);
    offset += bytes.length;
  };
  const addBytes = (bytes) => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const addObject = (id, body) => {
    offsets[id] = offset;
    addString(`${id} 0 obj\n${body}\nendobj\n`);
  };

  addString("%PDF-1.4\n");
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(2, `<< /Type /Pages /Kids [${images.map((_, index) => `${3 + index * 3} 0 R`).join(" ")}] /Count ${images.length} >>`);
  images.forEach((bytes, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageName = `Im${index}`;
    const content = `q\n612 0 0 792 0 0 cm\n/${imageName} Do\nQ`;
    addObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    addObject(contentId, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    offsets[imageId] = offset;
    addString(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
    addBytes(bytes);
    addString("\nendstream\nendobj\n");
  });
  const xrefOffset = offset;
  addString(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let index = 1; index < offsets.length; index += 1) addString(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  addString(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function openEmailDraft(project) {
  const subject = encodeURIComponent(`Invoice - ${project.name}`);
  const body = encodeURIComponent(`${buildReport(project)}\n\nA PDF invoice with proof photos has been generated. Attach the downloaded PDF before sending.`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function getInvoiceFilename(project) {
  return `${slugify(project.name || "projectproof-invoice")}-invoice.pdf`;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "projectproof";
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

async function copyReport(project) {
  const report = buildReport(project);
  await navigator.clipboard?.writeText(report).catch(() => {});
}

async function copyClientPortal(project) {
  await navigator.clipboard?.writeText(buildClientPortalPacket(project)).catch(() => {});
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
