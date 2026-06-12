/* ==========================================
   SalesFlow Core Application Bootstrapper (app.js)
   ========================================== */
import { store, getRelativeDate } from './store.js';
import { initDashboard } from './dashboard.js';
import { initKanban } from './kanban.js';
import { initTable } from './table.js';
import { initCalendar, downloadICS, getGoogleCalendarLink } from './calendar.js';
import { initNotifications } from './notifications.js';
import { parseExcelFile, importTasksToStore } from './importer.js';

document.addEventListener('DOMContentLoaded', () => {
    setupTimeClock();
    setupViewNavigation();
    setupModalHandlers();
    setupUpdatesGenerator();
    setupImporterHandlers();

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
});

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

    if (projectType === 'digital-marketing') {
        dmSection.classList.remove('hidden');
    } else if (projectType === 'nable-attendance') {
        nableSection.classList.remove('hidden');
    } else if (projectType === 'bni-tasks') {
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
        toggleSubForms(task.projectType);
        if (task.projectType === 'digital-marketing') {
            document.getElementById('dm-subproject').value = task.subproject || 'Website Development';
            document.getElementById('dm-client').value = task.clientName || '';
            document.getElementById('dm-start-date').value = task.startDate || '';
            document.getElementById('dm-deadline').value = task.deadline || '';
            document.getElementById('dm-stage').value = task.currentStage || '';
            document.getElementById('dm-next-action').value = task.nextAction || '';
        } else if (task.projectType === 'nable-attendance') {
            document.getElementById('nable-lead-status').value = task.leadStatus || 'Cold';
            document.getElementById('nable-installed').value = task.installed || 'No';
            document.getElementById('nable-credentials').value = task.credentials || '';
            document.getElementById('nable-demo').value = task.demoStage || 'None';
            document.getElementById('nable-contact').value = task.contactPerson || '';
            document.getElementById('nable-billing').value = task.billingDetails || '';
        } else if (task.projectType === 'bni-tasks') {
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
        if (filterVal !== 'all') {
            document.getElementById('form-project-type').value = filterVal;
            toggleSubForms(filterVal);
        } else {
            document.getElementById('form-project-type').value = 'digital-marketing';
            toggleSubForms('digital-marketing');
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
    if (projectType === 'digital-marketing') {
        taskData.subproject = document.getElementById('dm-subproject').value;
        taskData.clientName = document.getElementById('dm-client').value;
        taskData.startDate = document.getElementById('dm-start-date').value;
        taskData.deadline = document.getElementById('dm-deadline').value;
        taskData.currentStage = document.getElementById('dm-stage').value;
        taskData.nextAction = document.getElementById('dm-next-action').value;
    } else if (projectType === 'nable-attendance') {
        taskData.leadStatus = document.getElementById('nable-lead-status').value;
        taskData.installed = document.getElementById('nable-installed').value;
        taskData.credentials = document.getElementById('nable-credentials').value;
        taskData.demoStage = document.getElementById('nable-demo').value;
        taskData.contactPerson = document.getElementById('nable-contact').value;
        taskData.billingDetails = document.getElementById('nable-billing').value;
    } else if (projectType === 'bni-tasks') {
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
                reportText += `  * ${t.title} (${t.projectType === 'digital-marketing' ? 'DM' : t.projectType === 'nable-attendance' ? 'Nable' : 'BNI'})\n`;
                if (t.description) reportText += `    Description: ${t.description}\n`;
            });

            reportText += `\n⚡ ACTIVE & IN-PROGRESS (Today's Actions):\n`;
            if (activeToday.length === 0) reportText += `  - No active modifications today.\n`;
            activeToday.forEach(t => {
                reportText += `  * ${t.title} [Status: ${t.status.toUpperCase()}] [Priority: ${t.priority.toUpperCase()}]\n`;
                
                // Details
                if (t.projectType === 'digital-marketing') {
                    reportText += `    Stage: ${t.currentStage || 'N/A'} | Next Action: ${t.nextAction || 'None'}\n`;
                } else if (t.projectType === 'nable-attendance') {
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
            const nableDeals = tasks.filter(t => t.projectType === 'nable-attendance');
            const dmProjects = tasks.filter(t => t.projectType === 'digital-marketing');
            const bniTasks = tasks.filter(t => t.projectType === 'bni-tasks');

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
