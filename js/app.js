/* ==========================================
   SalesFlow Core Application Bootstrapper (app.js)
   ========================================== */
import { store, getRelativeDate } from './store.js';
import { initDashboard } from './dashboard.js';
import { initKanban } from './kanban.js';
import { initTable, exportTableToCSV } from './table.js';
import { initCalendar, downloadICS, getGoogleCalendarLink } from './calendar.js';
import { initNotifications } from './notifications.js';
import { parseExcelFile, importTasksToStore } from './importer.js';

document.addEventListener('DOMContentLoaded', () => {
    setupTimeClock();
    setupAuthentication();
});

function setupAuthentication() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.querySelector('.app-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('btn-logout-app');

    // Check existing session
    if (sessionStorage.getItem('salesflow_auth') === 'true') {
        showApp();
    } else {
        showLogin();
    }

    function showApp() {
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        initializeApplication();
    }

    function showLogin() {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('login-username');
            const passwordInput = document.getElementById('login-password');
            
            if (usernameInput && passwordInput) {
                const u = usernameInput.value.trim();
                const p = passwordInput.value.trim();
                
                // Door credentials
                if (u === 'admin' && p === 'salesflow2026') {
                    sessionStorage.setItem('salesflow_auth', 'true');
                    if (loginError) loginError.classList.add('hidden');
                    // Reset fields
                    usernameInput.value = '';
                    passwordInput.value = '';
                    showApp();
                } else {
                    if (loginError) loginError.classList.remove('hidden');
                }
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("Lock workspace and logout?")) {
                sessionStorage.removeItem('salesflow_auth');
                // Reload to completely tear down memory state & lock again
                location.reload();
            }
        });
    }
}

let appInitialized = false;
function initializeApplication() {
    if (appInitialized) return;
    appInitialized = true;

    setupViewNavigation();
    setupModalHandlers();
    setupUpdatesGenerator();
    setupImporterHandlers();
    setupProjectsManagerHandlers();

    // Wire up premium backup/restore and CSV export features
    const btnExportTable = document.getElementById('btn-export-table');
    if (btnExportTable) {
        btnExportTable.addEventListener('click', () => {
            exportTableToCSV();
        });
    }

    const btnExportBackup = document.getElementById('btn-export-backup');
    if (btnExportBackup) {
        btnExportBackup.addEventListener('click', () => {
            const backupStr = store.exportFullBackup();
            const blob = new Blob([backupStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `salesflow_backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    const btnImportTrigger = document.getElementById('btn-import-backup-trigger');
    const inputImportFile = document.getElementById('import-backup-file-input');
    if (btnImportTrigger && inputImportFile) {
        btnImportTrigger.addEventListener('click', () => {
            inputImportFile.click();
        });
        inputImportFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const success = store.importFullBackup(evt.target.result);
                    if (success) {
                        alert('Database restored successfully! Reloading...');
                        location.reload();
                    } else {
                        alert('Invalid backup file. Please select a valid SalesFlow backup JSON file.');
                    }
                };
                reader.readAsText(file);
            }
        });
    }

    setupCommandPalette();

    // Initialize reset button
    const resetBtn = document.getElementById('btn-reset-app');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear all tasks and start completely fresh from scratch? This will delete all local tasks permanently.")) {
                localStorage.clear();
                location.reload();
            }
        });
    }
    
    // Initialize modules
    initDashboard(openTaskModal);
    initKanban(openTaskModal);
    initTable(openTaskModal);
    initCalendar(openTaskModal);
    initNotifications(openTaskModal);
    
    // Initialize global quick add button
    const quickAddBtn = document.getElementById('btn-quick-add');
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            openTaskModal(null);
        });
    }

    // Set active project select default
    const globalFilter = document.getElementById('global-project-filter');
    if (globalFilter) {
        globalFilter.addEventListener('change', () => {
            // Force re-renders via store event
            window.dispatchEvent(new CustomEvent('store-updated'));
        });
    }
}

/* Live clock update */
function setupTimeClock() {
    const clockEl = document.getElementById('live-time');
    if (!clockEl) return;
    
    // Simulate timezone local to user (Jun 12, 2026 5:08 PM context)
    const updateTime = () => {
        const now = new Date();
        const options = { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        clockEl.textContent = now.toLocaleDateString('en-GB', options).replace(',', '');
    };
    
    updateTime();
    setInterval(updateTime, 30000);
}

/* Sidebar navigation between views */
function setupViewNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const panels = document.querySelectorAll('.view-panel');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetView = item.dataset.view;
            
            // Toggle sidebar active state
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Show panels
            panels.forEach(p => {
                p.classList.remove('active');
                if (p.id === `view-${targetView}`) {
                    p.classList.add('active');
                }
            });

            // Trigger updates on visible view
            window.dispatchEvent(new CustomEvent('store-updated'));
        });
    });
}

/* Modal form controls */
function setupModalHandlers() {
    const modal = document.getElementById('task-modal');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('btn-cancel-task');
    const deleteBtn = document.getElementById('btn-delete-task');
    const projectTypeSelect = document.getElementById('form-project-type');
    const hasDependencyCheckbox = document.getElementById('form-has-dependency');
    const dependencyDetails = document.getElementById('dependency-details-group');
    const form = document.getElementById('task-form');
    const icsBtn = document.getElementById('btn-download-ics');
    const googleCalBtn = document.getElementById('btn-google-cal');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Toggle sub-forms based on project type selected
    if (projectTypeSelect) {
        projectTypeSelect.addEventListener('change', () => {
            toggleSubForms(projectTypeSelect.value);
        });
    }

    // Toggle Blocker dependency details
    if (hasDependencyCheckbox && dependencyDetails) {
        hasDependencyCheckbox.addEventListener('change', () => {
            if (hasDependencyCheckbox.checked) {
                dependencyDetails.classList.remove('hidden');
            } else {
                dependencyDetails.classList.add('hidden');
            }
        });
    }

    // Form submission
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveForm();
        });
    }

    // Task deletion
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const taskId = document.getElementById('task-id').value;
            if (taskId && confirm('Are you sure you want to delete this task?')) {
                store.deleteTask(taskId);
                closeModal();
            }
        });
    }

    // Download ICS click handler
    if (icsBtn) {
        icsBtn.addEventListener('click', () => {
            const taskId = document.getElementById('task-id').value;
            const title = document.getElementById('form-task-title').value;
            const desc = document.getElementById('form-description').value;
            const followupDate = document.getElementById('form-followup-date').value;

            if (!followupDate) {
                alert('Please select a Follow-up Date first to generate a Calendar Event.');
                return;
            }

            // Standardize temporary task object to pass to exporter
            downloadICS({
                id: taskId || 'new',
                title: title || 'Follow up task',
                description: desc || '',
                followupDate: followupDate
            });
        });
    }

    // Google Calendar online link click handler
    if (googleCalBtn) {
        googleCalBtn.addEventListener('click', () => {
            const taskId = document.getElementById('task-id').value;
            const title = document.getElementById('form-task-title').value;
            const desc = document.getElementById('form-description').value;
            const followupDate = document.getElementById('form-followup-date').value;

            if (!followupDate) {
                alert('Please select a Follow-up Date first to generate a Calendar Event.');
                return;
            }

            const url = getGoogleCalendarLink({
                id: taskId || 'new',
                title: title || 'Follow up task',
                description: desc || '',
                followupDate: followupDate
            });
            if (url) {
                window.open(url, '_blank');
            }
        });
    }
}

function toggleSubForms(projectType) {
    const dmSection = document.getElementById('fields-digital-marketing');
    const nableSection = document.getElementById('fields-nable-attendance');
    const bniSection = document.getElementById('fields-bni-tasks');

    dmSection.classList.add('hidden');
    nableSection.classList.add('hidden');
    bniSection.classList.add('hidden');

    const project = store.getProjectById(projectType);
    const templateType = project ? project.templateType : projectType;

    if (templateType === 'digital-marketing') {
        dmSection.classList.remove('hidden');
    } else if (templateType === 'nable-attendance') {
        nableSection.classList.remove('hidden');
    } else if (templateType === 'bni-tasks') {
        bniSection.classList.remove('hidden');
    }
}

function closeModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.add('hidden');
}

export function openTaskModal(taskId = null) {
    const modal = document.getElementById('task-modal');
    const titleEl = document.getElementById('modal-title');
    const deleteBtn = document.getElementById('btn-delete-task');
    const form = document.getElementById('task-form');
    const historyBlock = document.getElementById('task-history-block');
    
    if (!modal) return;
    
    // Reset Form
    form.reset();
    document.getElementById('task-id').value = '';
    document.getElementById('dependency-details-group').classList.add('hidden');
    
    if (taskId) {
        // Edit Mode
        const task = store.getTaskById(taskId);
        if (!task) return;
        
        titleEl.textContent = `Edit Task: ${task.id}`;
        deleteBtn.classList.remove('hidden');
        historyBlock.classList.remove('hidden');

        // Populate base fields
        document.getElementById('task-id').value = task.id;
        document.getElementById('form-project-type').value = task.projectType;
        document.getElementById('form-project-type').disabled = true; // Block switching category on edit
        document.getElementById('form-task-title').value = task.title;
        document.getElementById('form-status').value = task.status;
        document.getElementById('form-priority').value = task.priority;
        document.getElementById('form-assigned-to').value = task.assignedTo || '';
        document.getElementById('form-followup-date').value = task.followupDate || '';
        document.getElementById('form-description').value = task.description || '';
        
        // Populate dependency
        document.getElementById('form-has-dependency').checked = !!task.hasDependency;
        if (task.hasDependency) {
            document.getElementById('dependency-details-group').classList.remove('hidden');
            document.getElementById('form-dependency-person').value = task.dependencyPerson || '';
            document.getElementById('form-dependency-issue').value = task.dependencyIssue || '';
        }

        // Tags
        document.getElementById('form-tags').value = (task.tags || []).join(', ');

        // Toggle subforms and fill properties
        const project = store.getProjectById(task.projectType);
        const templateType = project ? project.templateType : task.projectType;

        toggleSubForms(task.projectType);
        if (templateType === 'digital-marketing') {
            document.getElementById('dm-subproject').value = task.subproject || 'Website Development';
            document.getElementById('dm-client').value = task.clientName || '';
            document.getElementById('dm-start-date').value = task.startDate || '';
            document.getElementById('dm-deadline').value = task.deadline || '';
            document.getElementById('dm-stage').value = task.currentStage || '';
            document.getElementById('dm-next-action').value = task.nextAction || '';
        } else if (templateType === 'nable-attendance') {
            document.getElementById('nable-lead-status').value = task.leadStatus || 'Cold';
            document.getElementById('nable-installed').value = task.installed || 'No';
            document.getElementById('nable-credentials').value = task.credentials || '';
            document.getElementById('nable-demo').value = task.demoStage || 'None';
            document.getElementById('nable-contact').value = task.contactPerson || '';
            document.getElementById('nable-billing').value = task.billingDetails || '';
        } else if (templateType === 'bni-tasks') {
            document.getElementById('bni-meeting-date').value = task.bniMeetingDate || '';
            document.getElementById('bni-deadline').value = task.bniDeadline || '';
            document.getElementById('bni-assigned-by').value = task.bniAssignedBy || '';
            document.getElementById('bni-referral').value = task.bniReferral || '';
        }

        // Populate history timeline
        const timeline = document.getElementById('task-history-timeline');
        if (timeline && task.history) {
            timeline.innerHTML = task.history.map(item => `
                <div class="timeline-item">
                    <div class="timeline-item-meta">${item.timestamp} • By: ${item.user}</div>
                    <div>${item.message}</div>
                </div>
            `).reverse().join('');
        }
    } else {
        // Add Mode
        titleEl.textContent = 'New Task / Lead';
        deleteBtn.classList.add('hidden');
        historyBlock.classList.add('hidden');
        document.getElementById('form-project-type').disabled = false;

        // Auto-select project type based on active global filter
        const filterVal = document.getElementById('global-project-filter').value;
        const projects = store.getProjects();
        const defaultProjId = projects.length > 0 ? projects[0].id : 'digital-marketing';

        if (filterVal !== 'all') {
            document.getElementById('form-project-type').value = filterVal;
            toggleSubForms(filterVal);
        } else {
            document.getElementById('form-project-type').value = defaultProjId;
            toggleSubForms(defaultProjId);
        }
    }

    modal.classList.remove('hidden');
}

function saveForm() {
    const projectType = document.getElementById('form-project-type').value;
    const title = document.getElementById('form-task-title').value;
    
    // Prepare base task data object
    const taskData = {
        id: document.getElementById('task-id').value || undefined,
        projectType,
        title,
        status: document.getElementById('form-status').value,
        priority: document.getElementById('form-priority').value,
        assignedTo: document.getElementById('form-assigned-to').value,
        followupDate: document.getElementById('form-followup-date').value,
        description: document.getElementById('form-description').value,
        hasDependency: document.getElementById('form-has-dependency').checked,
        dependencyPerson: document.getElementById('form-has-dependency').checked ? document.getElementById('form-dependency-person').value : '',
        dependencyIssue: document.getElementById('form-has-dependency').checked ? document.getElementById('form-dependency-issue').value : '',
        progressLog: document.getElementById('form-progress-log').value.trim()
    };

    // Clean tags
    const tagsVal = document.getElementById('form-tags').value;
    taskData.tags = tagsVal ? tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

    // Project-specific forms
    const project = store.getProjectById(projectType);
    const templateType = project ? project.templateType : projectType;

    if (templateType === 'digital-marketing') {
        taskData.subproject = document.getElementById('dm-subproject').value;
        taskData.clientName = document.getElementById('dm-client').value;
        taskData.startDate = document.getElementById('dm-start-date').value;
        taskData.deadline = document.getElementById('dm-deadline').value;
        taskData.currentStage = document.getElementById('dm-stage').value;
        taskData.nextAction = document.getElementById('dm-next-action').value;
    } else if (templateType === 'nable-attendance') {
        taskData.leadStatus = document.getElementById('nable-lead-status').value;
        taskData.installed = document.getElementById('nable-installed').value;
        taskData.credentials = document.getElementById('nable-credentials').value;
        taskData.demoStage = document.getElementById('nable-demo').value;
        taskData.contactPerson = document.getElementById('nable-contact').value;
        taskData.billingDetails = document.getElementById('nable-billing').value;
    } else if (templateType === 'bni-tasks') {
        taskData.bniMeetingDate = document.getElementById('bni-meeting-date').value;
        taskData.bniDeadline = document.getElementById('bni-deadline').value;
        taskData.bniAssignedBy = document.getElementById('bni-assigned-by').value;
        taskData.bniReferral = document.getElementById('bni-referral').value;
    }

    // Save and dispatch updates
    store.saveTask(taskData);
    closeModal();
}

/* Daily, Weekly, Monthly Summary Reporter generator */
function setupUpdatesGenerator() {
    const generateBtn = document.getElementById('btn-generate-update');
    const copyBtn = document.getElementById('btn-copy-update');
    const outputArea = document.getElementById('update-report-text');
    const typeSelect = document.getElementById('update-type');
    const projectSelect = document.getElementById('update-project');
    const titleEl = document.getElementById('update-report-title');

    if (!generateBtn || !outputArea) return;

    generateBtn.addEventListener('click', () => {
        const type = typeSelect.value;
        const project = projectSelect.value;
        const tasks = store.getTasksFiltered({ projectType: project });

        let reportText = '';
        const todayStr = getRelativeDate(0);
        
        // Heading
        const headerTitle = `${type.toUpperCase()} STATUS REPORT - ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        titleEl.textContent = headerTitle;
        reportText += `==============================================\n`;
        reportText += `${headerTitle}\n`;
        reportText += `==============================================\n\n`;

        if (type === 'daily') {
            reportText += `SUMMARY OF TODAY'S COMPLETED AND IN-PROGRESS ITEMS:\n\n`;
            
            // Filters tasks changed or scheduled today
            const activeToday = tasks.filter(t => {
                const updatedToday = t.history && t.history.some(h => h.timestamp.includes(todayStr));
                const followupToday = t.followupDate === todayStr;
                return (updatedToday || followupToday) && t.status !== 'completed';
            });

            const completedToday = tasks.filter(t => {
                return t.status === 'completed' && t.history && t.history.some(h => h.timestamp.includes(todayStr));
            });

            reportText += `✅ COMPLETED TODAY:\n`;
            if (completedToday.length === 0) reportText += `  - No items marked completed today.\n`;
            completedToday.forEach(t => {
                const taskProj = store.getProjectById(t.projectType);
                const projLabel = taskProj ? taskProj.name : 'Task';
                reportText += `  * ${t.title} (${projLabel})\n`;
                if (t.description) reportText += `    Description: ${t.description}\n`;
            });

            reportText += `\n⚡ ACTIVE & IN-PROGRESS (Today's Actions):\n`;
            if (activeToday.length === 0) reportText += `  - No active modifications today.\n`;
            activeToday.forEach(t => {
                reportText += `  * ${t.title} [Status: ${t.status.toUpperCase()}] [Priority: ${t.priority.toUpperCase()}]\n`;
                
                // Details
                const taskProj = store.getProjectById(t.projectType);
                const templateType = taskProj ? taskProj.templateType : t.projectType;

                if (templateType === 'digital-marketing') {
                    reportText += `    Stage: ${t.currentStage || 'N/A'} | Next Action: ${t.nextAction || 'None'}\n`;
                } else if (templateType === 'nable-attendance') {
                    reportText += `    Lead Status: ${t.leadStatus} | Demo: ${t.demoStage}\n`;
                }
                
                if (t.hasDependency) {
                    reportText += `    ⚠️ BLOCKED BY: ${t.dependencyPerson} (${t.dependencyIssue})\n`;
                }
                
                // Get latest log today
                const todayLogs = t.history.filter(h => h.timestamp.includes(todayStr) && !h.message.includes('initialized') && !h.message.includes('captured'));
                if (todayLogs.length > 0) {
                    reportText += `    Updates: ${todayLogs.map(l => l.message).join('; ')}\n`;
                }
            });

        } else if (type === 'weekly') {
            reportText += `WEEKLY PROGRESS & OUTCOMES SUMMARY:\n\n`;
            
            // Find tasks modified in the past 7 days
            const weekAgoStr = getRelativeDate(-7);
            
            const activeThisWeek = tasks.filter(t => {
                return t.history && t.history.some(h => h.timestamp.split(' ')[0] >= weekAgoStr);
            });

            if (activeThisWeek.length === 0) {
                reportText += `  - No task activities recorded this week.\n`;
            } else {
                activeThisWeek.forEach(t => {
                    const statusText = t.status === 'completed' ? '✅ COMPLETED' : `⏳ ${t.status.toUpperCase()}`;
                    reportText += `${statusText} - ${t.title} (${t.assignedTo || 'Unassigned'})\n`;
                    
                    // Show recent logs
                    const logs = t.history.filter(h => h.timestamp.split(' ')[0] >= weekAgoStr);
                    logs.forEach(l => {
                        reportText += `    • [${l.timestamp.split(' ')[0]}] ${l.message}\n`;
                    });
                    
                    if (t.followupDate) {
                        reportText += `    • NEXT FOLLOW-UP DATE: ${t.followupDate}\n`;
                    }
                    reportText += `\n`;
                });
            }

        } else if (type === 'monthly') {
            reportText += `MONTHLY CRM PIPELINE & SALES SUMMARY:\n\n`;
            
            // Calculate sales pipeline conversions (completed Nable tasks or DM won status)
            const nableDeals = tasks.filter(t => {
                const p = store.getProjectById(t.projectType);
                return (p ? p.templateType : t.projectType) === 'nable-attendance';
            });
            const dmProjects = tasks.filter(t => {
                const p = store.getProjectById(t.projectType);
                return (p ? p.templateType : t.projectType) === 'digital-marketing';
            });
            const bniTasks = tasks.filter(t => {
                const p = store.getProjectById(t.projectType);
                return (p ? p.templateType : t.projectType) === 'bni-tasks';
            });

            reportText += `📊 TOTAL PIPELINE STATUS:\n`;
            reportText += `  * Nable CRM Deals Won/Installed: ${nableDeals.filter(t => t.leadStatus === 'Won / Installed' || t.installed === 'Yes').length} Leads\n`;
            reportText += `  * Nable Active CRM Pipelines: ${nableDeals.filter(t => t.status !== 'completed').length} Leads\n`;
            reportText += `  * Digital Marketing Active Sites: ${dmProjects.filter(t => t.subproject === 'Website Development' && t.status !== 'completed').length} Sites\n`;
            reportText += `  * Active SEO Audits: ${dmProjects.filter(t => t.subproject === 'SEO' && t.status !== 'completed').length} Contracts\n`;
            reportText += `  * BNI Referrals Converted: ${bniTasks.filter(t => t.status === 'completed').length} Referrals\n\n`;

            reportText += `⚠️ HIGH PRIORITY UNRESOLVED BLOCKERS:\n`;
            const highBlockers = tasks.filter(t => t.priority === 'high' && t.hasDependency && t.status !== 'completed');
            if (highBlockers.length === 0) {
                reportText += `  - No high-priority blockers outstanding!\n`;
            } else {
                highBlockers.forEach(b => {
                    reportText += `  * ${b.title} (Blocker: ${b.dependencyPerson} - ${b.dependencyIssue})\n`;
                });
            }
        }

        reportText += `\nGenerated dynamically from SalesFlow CRM system.`;
        outputArea.value = reportText;
    });

    // Copy to clipboard
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (!outputArea.value) {
                alert('Please generate a report first.');
                return;
            }
            outputArea.select();
            document.execCommand('copy');
            
            // Flash feedback
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = `<span class="material-symbols-outlined">done</span><span>Copied!</span>`;
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        });
    }
}

let pendingImportTasks = [];

function setupImporterHandlers() {
    const openImportBtn = document.getElementById('btn-open-import');
    const importModal = document.getElementById('import-modal');
    const closeImportBtn = document.getElementById('import-modal-close');
    const cancelImportBtn = document.getElementById('btn-cancel-import');
    const confirmImportBtn = document.getElementById('btn-confirm-import');
    const dropzone = document.getElementById('import-dropzone');
    const fileInput = document.getElementById('import-file-input');
    const projectSelect = document.getElementById('import-project-type');
    const previewContainer = document.getElementById('import-preview-container');
    const previewTable = document.getElementById('import-preview-table');
    const previewTbody = document.getElementById('import-preview-tbody');
    const statsEl = document.getElementById('import-stats');

    if (!openImportBtn || !importModal) return;

    // Open Modal
    openImportBtn.addEventListener('click', () => {
        importModal.classList.remove('hidden');
        resetImportWizard();
    });

    // Close Modal
    const closeModal = () => {
        importModal.classList.add('hidden');
        resetImportWizard();
    };
    if (closeImportBtn) closeImportBtn.addEventListener('click', closeModal);
    if (cancelImportBtn) cancelImportBtn.addEventListener('click', closeModal);

    // Reset Wizard State
    function resetImportWizard() {
        pendingImportTasks = [];
        if (fileInput) fileInput.value = '';
        if (previewContainer) previewContainer.classList.add('hidden');
        if (confirmImportBtn) {
            confirmImportBtn.classList.add('disabled');
            confirmImportBtn.disabled = true;
            confirmImportBtn.style.opacity = '0.5';
            confirmImportBtn.style.pointerEvents = 'none';
        }
        if (dropzone) {
            dropzone.style.background = 'rgba(255,255,255,0.01)';
            dropzone.style.borderColor = 'var(--border-glass)';
        }
    }

    // Trigger file selection clicking dropzone
    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag events
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.background = 'rgba(88, 166, 255, 0.05)';
            dropzone.style.borderColor = 'var(--color-primary)';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.background = 'rgba(255,255,255,0.01)';
            dropzone.style.borderColor = 'var(--border-glass)';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.background = 'rgba(255,255,255,0.01)';
            dropzone.style.borderColor = 'var(--border-glass)';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    // Process file
    function handleFileSelect(file) {
        const projectType = projectSelect.value;
        
        parseExcelFile(file, projectType, (err, tasks) => {
            if (err) {
                alert(`Error parsing file: ${err.message || err}`);
                resetImportWizard();
                return;
            }
            
            pendingImportTasks = tasks;
            
            // Show preview
            showPreview(tasks, projectType);
        });
    }

    function showPreview(tasks, projectType) {
        if (!previewContainer || !previewTbody || !previewTable) return;

        statsEl.textContent = `Successfully parsed ${tasks.length} rows. Previewing first 5 rows:`;
        previewTbody.innerHTML = '';

        // Dynamic Headers
        const thead = previewTable.querySelector('thead');
        let headers = ['Task / Client Name', 'Priority', 'Status', 'Assigned To'];
        if (projectType === 'digital-marketing') {
            headers.push('Deadline', 'Stage');
        } else if (projectType === 'nable-attendance') {
            headers.push('Contact Info', 'Lead Status');
        } else if (projectType === 'bni-tasks') {
            headers.push('Referral', 'Deadline');
        }
        thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

        // Dynamic Rows (preview max 5)
        const previewRows = tasks.slice(0, 5);
        previewRows.forEach(task => {
            const tr = document.createElement('tr');
            let cols = [
                task.title,
                `<span class="badge ${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'success'}">${task.priority}</span>`,
                `<span class="badge ${task.status === 'completed' ? 'success' : task.status === 'in-progress' ? 'info' : 'warning'}">${task.status}</span>`,
                task.assignedTo || 'Unassigned'
            ];

            if (projectType === 'digital-marketing') {
                cols.push(task.deadline || '-', task.currentStage || '-');
            } else if (projectType === 'nable-attendance') {
                cols.push(task.contactPerson || '-', task.leadStatus || '-');
            } else if (projectType === 'bni-tasks') {
                cols.push(task.bniReferral || '-', task.bniDeadline || '-');
            }

            tr.innerHTML = cols.map(c => `<td>${c}</td>`).join('');
            previewTbody.appendChild(tr);
        });

        // Show container and enable confirm button
        previewContainer.classList.remove('hidden');
        if (confirmImportBtn) {
            confirmImportBtn.classList.remove('disabled');
            confirmImportBtn.disabled = false;
            confirmImportBtn.style.opacity = '1';
            confirmImportBtn.style.pointerEvents = 'auto';
        }
    }

    // Save and close
    if (confirmImportBtn) {
        confirmImportBtn.addEventListener('click', () => {
            if (pendingImportTasks.length === 0) return;
            
            const count = importTasksToStore(pendingImportTasks);
            alert(`Successfully imported ${count} tasks!`);
            closeModal();
            
            // Force re-renders
            window.dispatchEvent(new CustomEvent('store-updated'));
        });
    }
}

function populateProjectDropdowns() {
    const projects = store.getProjects();
    
    // 1. global-project-filter
    const globalFilter = document.getElementById('global-project-filter');
    if (globalFilter) {
        const currentVal = globalFilter.value;
        globalFilter.innerHTML = '<option value="all">All Projects</option>' + 
            projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        if ([...globalFilter.options].some(opt => opt.value === currentVal)) {
            globalFilter.value = currentVal;
        } else {
            globalFilter.value = 'all';
        }
    }
    
    // 2. form-project-type
    const formProject = document.getElementById('form-project-type');
    if (formProject) {
        const currentVal = formProject.value;
        formProject.innerHTML = projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        if ([...formProject.options].some(opt => opt.value === currentVal)) {
            formProject.value = currentVal;
        }
    }
    
    // 3. import-project-type
    const importProject = document.getElementById('import-project-type');
    if (importProject) {
        const currentVal = importProject.value;
        importProject.innerHTML = projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        if ([...importProject.options].some(opt => opt.value === currentVal)) {
            importProject.value = currentVal;
        }
    }
    
    // 4. update-project
    const updateProject = document.getElementById('update-project');
    if (updateProject) {
        const currentVal = updateProject.value;
        updateProject.innerHTML = '<option value="all">All Scopes</option>' + 
            projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        if ([...updateProject.options].some(opt => opt.value === currentVal)) {
            updateProject.value = currentVal;
        } else {
            updateProject.value = 'all';
        }
    }
}

function renderManageProjectsList() {
    const listContainer = document.getElementById('manage-projects-list');
    if (!listContainer) return;
    
    const projects = store.getProjects();
    listContainer.innerHTML = projects.map(p => {
        const icon = p.templateType === 'digital-marketing' 
            ? 'campaign' 
            : p.templateType === 'nable-attendance' ? 'badge' : 'groups';
        return `
            <div class="project-item" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <span class="material-symbols-outlined" style="color: var(--text-muted); font-size: 18px;">${icon}</span>
                    <input type="text" class="form-control rename-project-input" data-project-id="${p.id}" value="${p.name}" style="padding: 4px 8px; font-size: 13px; height: auto; background: rgba(255,255,255,0.05); border: 1px solid transparent; border-radius: 6px; flex: 1;" />
                </div>
                <button class="btn btn-icon btn-sm btn-delete-project" data-project-id="${p.id}" title="Delete Project" style="color: var(--color-danger); background: rgba(248,81,73,0.05); padding: 4px; border-radius: 6px; border: none; cursor: pointer; display: flex; align-items: center;">
                    <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                </button>
            </div>
        `;
    }).join('');

    // Attach listeners
    listContainer.querySelectorAll('.rename-project-input').forEach(input => {
        const id = input.dataset.projectId;
        const originalValue = input.value;
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
        
        input.addEventListener('blur', () => {
            const val = input.value.trim();
            if (val && val !== originalValue) {
                store.renameProject(id, val);
            } else {
                input.value = originalValue;
            }
        });
    });

    listContainer.querySelectorAll('.btn-delete-project').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.projectId;
            const proj = store.getProjectById(id);
            if (proj) {
                if (confirm(`Are you sure you want to delete the project "${proj.name}"? This will permanently delete all tasks associated with it.`)) {
                    store.deleteProject(id);
                }
            }
        });
    });
}

function setupProjectsManagerHandlers() {
    const btnManage = document.getElementById('btn-manage-projects');
    const modal = document.getElementById('projects-modal');
    const modalClose = document.getElementById('projects-modal-close');
    const btnAddSubmit = document.getElementById('btn-add-project-submit');

    if (btnManage && modal) {
        btnManage.addEventListener('click', () => {
            modal.classList.remove('hidden');
            renderManageProjectsList();
        });
    }

    if (modalClose && modal) {
        modalClose.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    if (btnAddSubmit) {
        btnAddSubmit.addEventListener('click', () => {
            const inputName = document.getElementById('new-project-name');
            const selectTemplate = document.getElementById('new-project-template');
            if (inputName && selectTemplate) {
                const name = inputName.value.trim();
                const template = selectTemplate.value;
                if (!name) {
                    alert('Please enter a project workspace name.');
                    return;
                }
                store.addProject(name, template);
                inputName.value = '';
            }
        });
    }

    // Listen for store updates to keep UI synchronized
    window.addEventListener('store-updated', () => {
        populateProjectDropdowns();
        renderManageProjectsList();
    });

    // Run initial population
    populateProjectDropdowns();
}

function setupCommandPalette() {
    const modal = document.getElementById('command-palette-modal');
    const input = document.getElementById('command-palette-input');
    const resultsContainer = document.getElementById('command-palette-results');
    
    if (!modal || !input || !resultsContainer) return;

    let isOpen = false;
    let items = []; // Holds current filtered items list
    let activeIndex = 0;

    // Global keys
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            if (isOpen) {
                closePalette();
            } else {
                openPalette();
            }
        }
        if (e.key === 'Escape' && isOpen) {
            closePalette();
        }
    });

    function openPalette() {
        isOpen = true;
        modal.classList.remove('hidden');
        input.value = '';
        input.focus();
        activeIndex = 0;
        renderResults();
    }

    function closePalette() {
        isOpen = false;
        modal.classList.add('hidden');
    }

    // Close when clicking outside palette box
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closePalette();
        }
    });

    // Search filter input
    input.addEventListener('input', () => {
        activeIndex = 0;
        renderResults();
    });

    // Arrow navigation keys
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
            updateActiveHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            updateActiveHighlight();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items[activeIndex]) {
                executeItem(items[activeIndex]);
            }
        }
    });

    function renderResults() {
        const query = input.value.trim().toLowerCase();
        items = getFilteredItems(query);

        if (items.length === 0) {
            resultsContainer.innerHTML = `<div class="empty-state" style="padding: 16px;">No results found for "${input.value}"</div>`;
            return;
        }

        // Group items by type (Commands vs Tasks)
        let html = '';
        let currentType = '';

        items.forEach((item, index) => {
            if (item.typeGroup !== currentType) {
                currentType = item.typeGroup;
                html += `<div class="palette-group-title">${currentType}</div>`;
            }

            const isActive = index === activeIndex ? 'active' : '';
            html += `
                <div class="palette-item ${isActive}" data-index="${index}">
                    <span class="material-symbols-outlined item-icon">${item.icon}</span>
                    <div class="item-info">
                        <span class="item-title">${item.title}</span>
                        ${item.meta ? `<span class="item-meta">${item.meta}</span>` : ''}
                    </div>
                    ${item.badge ? `<span class="item-badge">${item.badge}</span>` : ''}
                </div>
            `;
        });

        resultsContainer.innerHTML = html;

        // Item click handlers
        resultsContainer.querySelectorAll('.palette-item').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.dataset.index);
                if (items[index]) {
                    executeItem(items[index]);
                }
            });
        });
    }

    function updateActiveHighlight() {
        resultsContainer.querySelectorAll('.palette-item').forEach((el, index) => {
            if (index === activeIndex) {
                el.classList.add('active');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('active');
            }
        });
    }

    function getFilteredItems(query) {
        const commands = [
            { title: 'Navigate: Dashboard', icon: 'dashboard', typeGroup: 'Commands', badge: 'Go', action: () => navigateToView('dashboard') },
            { title: 'Navigate: Kanban Board', icon: 'view_kanban', typeGroup: 'Commands', badge: 'Go', action: () => navigateToView('board') },
            { title: 'Navigate: List / Table', icon: 'table_chart', typeGroup: 'Commands', badge: 'Go', action: () => navigateToView('table') },
            { title: 'Navigate: Calendar', icon: 'calendar_today', typeGroup: 'Commands', badge: 'Go', action: () => navigateToView('calendar') },
            { title: 'Navigate: Update Center', icon: 'history_edu', typeGroup: 'Commands', badge: 'Go', action: () => navigateToView('updates') },
            { title: 'Action: Create New Task / Lead', icon: 'add', typeGroup: 'Commands', badge: 'New', action: () => { openTaskModal(null); } },
            { title: 'Action: Manage Project Workspaces', icon: 'settings', typeGroup: 'Commands', badge: 'Config', action: () => { document.getElementById('projects-modal').classList.remove('hidden'); renderManageProjectsList(); } }
        ];

        const tasks = store.getAllTasks().map(t => {
            const proj = store.getProjectById(t.projectType);
            const projLabel = proj ? proj.name : t.projectType;
            return {
                title: t.title,
                icon: 'assignment',
                typeGroup: 'Tasks',
                meta: `Project: ${projLabel} | Status: ${t.status.toUpperCase()} | Assigned to: ${t.assignedTo || 'Self'}`,
                action: () => { openTaskModal(t.id); }
            };
        });

        const allItems = [...commands, ...tasks];

        if (!query) return allItems;

        return allItems.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const metaMatch = item.meta && item.meta.toLowerCase().includes(query);
            return titleMatch || metaMatch;
        });
    }

    function executeItem(item) {
        closePalette();
        if (typeof item.action === 'function') {
            item.action();
        }
    }

    function navigateToView(viewName) {
        const navItems = document.querySelectorAll('.nav-item');
        const panels = document.querySelectorAll('.view-panel');
        
        navItems.forEach(item => {
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        panels.forEach(p => {
            if (p.id === `view-${viewName}`) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });

        // Force re-renders
        window.dispatchEvent(new CustomEvent('store-updated'));
    }
}
