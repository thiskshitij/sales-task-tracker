/* ==========================================
   SalesFlow Store Management (store.js)
   ========================================== */

// Helper to get dates relative to today
export function getRelativeDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
}

const todayStr = getRelativeDate(0);
const tomorrowStr = getRelativeDate(1);
const yesterdayStr = getRelativeDate(-1);

// High-fidelity initial sample data
const defaultTasks = [];

const defaultProjects = [
    { id: 'digital-marketing', name: 'Digital Marketing', templateType: 'digital-marketing' },
    { id: 'nable-attendance', name: 'Nable Attendance Software', templateType: 'nable-attendance' },
    { id: 'bni-tasks', name: 'BNI Tasks', templateType: 'bni-tasks' }
];

class SalesStore {
    constructor() {
        this.tasks = [];
        this.projects = [];
        this.syncStatus = 'loading';
        this.isBulkImport = false;
        this.init();
    }

    init() {
        const stored = localStorage.getItem('salesflow_tasks_v3');
        if (stored) {
            try {
                this.tasks = JSON.parse(stored);
                if (!Array.isArray(this.tasks)) {
                    throw new Error("Tasks must be an array");
                }
            } catch (e) {
                console.error("Failed to parse stored tasks, resetting...", e);
                this.tasks = [...defaultTasks];
                this.saveToStorage();
            }
        } else {
            this.tasks = [...defaultTasks];
            this.saveToStorage();
        }

        const storedProj = localStorage.getItem('salesflow_projects_v1');
        if (storedProj) {
            try {
                this.projects = JSON.parse(storedProj);
                if (!Array.isArray(this.projects) || this.projects.length === 0) {
                    throw new Error("Projects must be a non-empty array");
                }
            } catch (e) {
                console.error("Failed to parse stored projects, resetting...", e);
                this.projects = [...defaultProjects];
                this.saveToStorage();
            }
        } else {
            this.projects = [...defaultProjects];
            this.saveToStorage();
        }

        // Trigger background cloud sync
        this.syncFromCloud();

        // Start periodic sync every 15 seconds
        setInterval(() => {
            this.syncFromCloud();
        }, 15000);

        // Also sync when the page becomes visible / focused
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.syncFromCloud();
            }
        });
    }

    updateSyncStatus(status) {
        this.syncStatus = status;
        window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: status }));
    }

    async syncFromCloud() {
        // Only set status to 'loading' if not already syncing a write request
        if (this.syncStatus !== 'syncing') {
            this.updateSyncStatus('loading');
        }
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error("Failed to fetch from cloud database");
            const data = await response.json();
            
            if (data && Array.isArray(data.projects) && Array.isArray(data.tasks)) {
                // Check if data actually changed to avoid unnecessary re-renders
                const tasksChanged = JSON.stringify(this.tasks) !== JSON.stringify(data.tasks);
                const projectsChanged = JSON.stringify(this.projects) !== JSON.stringify(data.projects);
                
                if (tasksChanged || projectsChanged) {
                    this.projects = data.projects;
                    this.tasks = data.tasks;
                    
                    // Cache locally
                    localStorage.setItem('salesflow_tasks_v3', JSON.stringify(this.tasks));
                    localStorage.setItem('salesflow_projects_v1', JSON.stringify(this.projects));
                    
                    // Dispatch event to redraw everything
                    window.dispatchEvent(new CustomEvent('store-updated'));
                }
                
                this.updateSyncStatus('synced');
                return true;
            }
        } catch (err) {
            console.error("Cloud sync failed, using offline cache:", err);
            this.updateSyncStatus('offline');
        }
        return false;
    }

    syncAllToCloud() {
        this.updateSyncStatus('syncing');
        const payload = {
            projects: this.projects,
            tasks: this.tasks
        };
        fetch('/api/sync-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(() => this.updateSyncStatus('synced'))
        .catch(err => {
            console.error("Failed to sync full database:", err);
            this.updateSyncStatus('error');
        });
    }

    saveToStorage() {
        localStorage.setItem('salesflow_tasks_v3', JSON.stringify(this.tasks));
        localStorage.setItem('salesflow_projects_v1', JSON.stringify(this.projects));
        // Dispatch custom event to notify other modules of updates
        window.dispatchEvent(new CustomEvent('store-updated'));
    }

    getProjects() {
        return this.projects;
    }

    getProjectById(id) {
        return this.projects.find(p => p.id === id);
    }

    addProject(name, templateType) {
        const id = 'project-' + Date.now();
        const proj = { id, name, templateType };
        this.projects.push(proj);
        this.saveToStorage();

        this.updateSyncStatus('syncing');
        fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proj)
        })
        .then(() => this.updateSyncStatus('synced'))
        .catch(err => {
            console.error("Failed to sync project creation:", err);
            this.updateSyncStatus('error');
        });

        return id;
    }

    renameProject(id, newName) {
        const proj = this.projects.find(p => p.id === id);
        if (proj) {
            proj.name = newName;
            this.saveToStorage();

            this.updateSyncStatus('syncing');
            fetch(`/api/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            })
            .then(() => this.updateSyncStatus('synced'))
            .catch(err => {
                console.error("Failed to sync project rename:", err);
                this.updateSyncStatus('error');
            });

            return true;
        }
        return false;
    }

    deleteProject(id) {
        this.projects = this.projects.filter(p => p.id !== id);
        // Clean up tasks belonging to this project
        this.tasks = this.tasks.filter(t => t.projectType !== id);
        this.saveToStorage();

        this.updateSyncStatus('syncing');
        fetch(`/api/projects/${id}`, {
            method: 'DELETE'
        })
        .then(() => this.updateSyncStatus('synced'))
        .catch(err => {
            console.error("Failed to sync project deletion:", err);
            this.updateSyncStatus('error');
        });

        return true;
    }

    getAllTasks() {
        return this.tasks;
    }

    getTasksFiltered({ projectType = 'all', priority = 'all', status = 'all', search = '' } = {}) {
        return this.tasks.filter(task => {
            // Project filter
            if (projectType !== 'all' && task.projectType !== projectType) return false;
            
            // Priority filter
            if (priority !== 'all' && task.priority !== priority) return false;
            
            // Status filter
            if (status !== 'all' && task.status !== status) return false;
            
            // Search query filter (checks title, description, clientName, contacts, tags)
            if (search.trim()) {
                const q = search.toLowerCase();
                const titleMatch = (task.title || '').toLowerCase().includes(q);
                const descMatch = (task.description || '').toLowerCase().includes(q);
                const clientMatch = (task.clientName || '').toLowerCase().includes(q);
                const contactMatch = (task.contactPerson || '').toLowerCase().includes(q);
                const tagsMatch = (task.tags || []).some(t => t.toLowerCase().includes(q));
                
                if (!titleMatch && !descMatch && !clientMatch && !contactMatch && !tagsMatch) {
                    return false;
                }
            }
            return true;
        });
    }

    getTaskById(id) {
        return this.tasks.find(t => t.id === id);
    }

    deleteTask(id) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.tasks.splice(index, 1);
            this.saveToStorage();

            this.updateSyncStatus('syncing');
            fetch(`/api/tasks/${id}`, {
                method: 'DELETE'
            })
            .then(() => this.updateSyncStatus('synced'))
            .catch(err => {
                console.error("Failed to sync task deletion:", err);
                this.updateSyncStatus('error');
            });

            return true;
        }
        return false;
    }

    saveTask(taskData) {
        const isNew = !taskData.id;
        const now = new Date();
        const timestamp = now.toLocaleDateString() + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let task = null;
        
        if (isNew) {
            task = {
                id: taskData.projectType.substring(0, 3) + "-" + Date.now(),
                history: [{ timestamp, user: "System", message: "Task captured." }],
                ...taskData
            };
            
            // Log details initially
            if (taskData.progressLog) {
                task.history.push({ timestamp, user: taskData.assignedTo || "You", message: taskData.progressLog });
            }
            delete task.progressLog;
            
            this.tasks.unshift(task);
        } else {
            task = this.tasks.find(t => t.id === taskData.id);
            if (!task) return null;
            
            // Generate audit logs for changes
            const logs = [];
            
            if (task.status !== taskData.status) {
                logs.push(`Status changed from '${task.status}' to '${taskData.status}'.`);
            }
            if (task.priority !== taskData.priority) {
                logs.push(`Priority changed from '${task.priority}' to '${taskData.priority}'.`);
            }
            if (task.followupDate !== taskData.followupDate && taskData.followupDate) {
                logs.push(`Follow-up date updated to ${taskData.followupDate}.`);
            }
            
            const project = this.getProjectById(taskData.projectType);
            const templateType = project ? project.templateType : taskData.projectType;

            // Check project-specific fields
            if (templateType === 'digital-marketing') {
                if (task.currentStage !== taskData.currentStage) {
                    logs.push(`Stage updated to '${taskData.currentStage}'.`);
                }
                if (task.nextAction !== taskData.nextAction && taskData.nextAction) {
                    logs.push(`Next action updated: '${taskData.nextAction}'.`);
                }
            } else if (templateType === 'nable-attendance') {
                if (task.leadStatus !== taskData.leadStatus) {
                    logs.push(`Lead Status changed to '${taskData.leadStatus}'.`);
                }
                if (task.installed !== taskData.installed) {
                    logs.push(`Software installation status toggled to '${taskData.installed}'.`);
                }
            }
            
            if (taskData.progressLog) {
                logs.push(`Progress log added: "${taskData.progressLog}"`);
            }
            
            // Update fields
            Object.assign(task, taskData);
            delete task.progressLog;
            
            // Append change histories
            logs.forEach(msg => {
                task.history.push({ timestamp, user: taskData.assignedTo || "You", message: msg });
            });
        }
        
        this.saveToStorage();

        if (!this.isBulkImport) {
            this.updateSyncStatus('syncing');
            fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            })
            .then(() => this.updateSyncStatus('synced'))
            .catch(err => {
                console.error("Failed to sync task save:", err);
                this.updateSyncStatus('error');
            });
        }

        return task;
    }

    // Export whole store to JSON string
    exportData() {
        return JSON.stringify(this.tasks, null, 2);
    }

    // Import from JSON string (overwrites or merges)
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (Array.isArray(data)) {
                this.tasks = data;
                this.saveToStorage();
                this.syncAllToCloud();
                return true;
            }
        } catch (e) {
            console.error("Failed to import tasks:", e);
        }
        return false;
    }

    // Export whole store (tasks + projects) to JSON string
    exportFullBackup() {
        const payload = {
            version: 'salesflow_backup_v1',
            timestamp: new Date().toISOString(),
            projects: this.projects,
            tasks: this.tasks
        };
        return JSON.stringify(payload, null, 2);
    }

    // Import from JSON string backup (overwrites tasks & projects)
    importFullBackup(jsonString) {
        try {
            const payload = JSON.parse(jsonString);
            if (payload && payload.version === 'salesflow_backup_v1' && Array.isArray(payload.projects) && Array.isArray(payload.tasks)) {
                this.projects = payload.projects;
                this.tasks = payload.tasks;
                this.saveToStorage();
                this.syncAllToCloud();
                return true;
            }
        } catch (e) {
            console.error("Failed to restore full database backup:", e);
        }
        return false;
    }
}

export const store = new SalesStore();
