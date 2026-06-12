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
const defaultTasks = [
    // --- Digital Marketing Tasks ---
    {
        id: "dm-1",
        projectType: "digital-marketing",
        title: "Solaris Energy Web Dev",
        subproject: "Website Development",
        clientName: "Mr. Amit Roy",
        startDate: getRelativeDate(-11),
        deadline: getRelativeDate(13),
        currentStage: "Backend API Integration",
        description: "Re-platforming the corporate web portal with dashboard and custom quote form.",
        assignedTo: "Sameer",
        status: "in-progress",
        priority: "high",
        hasDependency: true,
        dependencyPerson: "Client (Mr. Amit)",
        dependencyIssue: "Waiting for payment gateway sandbox API credentials.",
        nextAction: "Integrate CCAvenue API once credentials are provided",
        tags: ["webdev", "ccavenue", "solaris"],
        followupDate: todayStr, // follow up today about credentials!
        history: [
            { timestamp: getRelativeDate(-11) + " 10:00 AM", user: "System", message: "Task initialized." },
            { timestamp: getRelativeDate(-8) + " 02:30 PM", user: "Sameer", message: "Figma UI layouts approved by client. Coding started." },
            { timestamp: getRelativeDate(-2) + " 11:15 AM", user: "Sameer", message: "Backend database configured. Blocked waiting for payment credentials." }
        ]
    },
    {
        id: "dm-2",
        projectType: "digital-marketing",
        title: "Karan Dental Clinic SEO",
        subproject: "SEO",
        clientName: "Dr. Karan Malhotra",
        startDate: getRelativeDate(-25),
        deadline: getRelativeDate(60),
        currentStage: "On-page optimization & audits",
        description: "Focus on local search keywords, optimizing Google Business Profile, and writing dental blogs.",
        assignedTo: "Priya",
        status: "in-progress",
        priority: "medium",
        hasDependency: false,
        dependencyPerson: "",
        dependencyIssue: "",
        nextAction: "Complete meta tags audit and submit weekly reports",
        tags: ["seo", "local-seo", "dental"],
        followupDate: tomorrowStr,
        history: [
            { timestamp: getRelativeDate(-25) + " 09:00 AM", user: "System", message: "SEO onboarding complete." },
            { timestamp: getRelativeDate(-15) + " 04:00 PM", user: "Priya", message: "Competitor keyword gap analysis completed." }
        ]
    },
    {
        id: "dm-3",
        projectType: "digital-marketing",
        title: "FitLife Gym Campaign",
        subproject: "Marketing",
        clientName: "Coach Rohan",
        startDate: getRelativeDate(-2),
        deadline: getRelativeDate(18),
        currentStage: "Campaign design",
        description: "Social media ad copy and creative banners for monsoon discount campaign.",
        assignedTo: "Self",
        status: "not-started",
        priority: "low",
        hasDependency: false,
        dependencyPerson: "",
        dependencyIssue: "",
        nextAction: "Draft facebook ad budget split",
        tags: ["marketing", "socialmedia", "ads"],
        followupDate: getRelativeDate(4),
        history: [
            { timestamp: getRelativeDate(-2) + " 03:20 PM", user: "System", message: "Campaign task logged." }
        ]
    },
    
    // --- Nable Attendance Software Tasks ---
    {
        id: "nable-1",
        projectType: "nable-attendance",
        title: "Zenith Tech Solutions",
        leadStatus: "Demo Scheduled",
        credentials: "URL: zenith.nable.in | User: admin | Pass: Demo@123",
        demoStage: "Scheduled",
        followupDate: todayStr, // Demo scheduled for today!
        installed: "No",
        contactPerson: "Dr. Vikas Sharma (+91 98765 43210)",
        billingDetails: "Quote sent for Annual License - Rs 25,000 + GST",
        assignedTo: "Self",
        status: "in-progress",
        priority: "high",
        hasDependency: false,
        dependencyPerson: "",
        dependencyIssue: "",
        description: "Met HR head at networking event. They need biometrics + mobile app tracking for 120 employees.",
        tags: ["lead", "demo", "attendance"],
        history: [
            { timestamp: getRelativeDate(-5) + " 11:30 AM", user: "System", message: "Lead captured from BNI reference." },
            { timestamp: getRelativeDate(-3) + " 02:00 PM", user: "Self", message: "Sent email introducing Nable app features. HR manager showed high interest." },
            { timestamp: getRelativeDate(-1) + " 10:45 AM", user: "Self", message: "Scheduled online live demo for Friday." }
        ]
    },
    {
        id: "nable-2",
        projectType: "nable-attendance",
        title: "Bright Minds Academy",
        leadStatus: "Won / Installed",
        credentials: "URL: bma.nable.in | Port: 8080",
        demoStage: "Done",
        followupDate: getRelativeDate(15),
        installed: "Yes",
        contactPerson: "Mrs. Kapoor (Principal)",
        billingDetails: "Rs 15,000 received via UPI (One-time setup + 1 Year SaaS)",
        assignedTo: "Priya",
        status: "completed",
        priority: "medium",
        hasDependency: false,
        dependencyPerson: "",
        dependencyIssue: "",
        description: "Attendance client system successfully configured on local Windows Server and integrated with face scanners.",
        tags: ["installed", "client", "school"],
        history: [
            { timestamp: getRelativeDate(-30) + " 10:00 AM", user: "System", message: "Lead captured." },
            { timestamp: getRelativeDate(-20) + " 02:00 PM", user: "Priya", message: "Demo completed successfully at school computer lab." },
            { timestamp: getRelativeDate(-10) + " 05:00 PM", user: "Priya", message: "Installation done. Checked face capture matching speed - OK." }
        ]
    },
    {
        id: "nable-3",
        projectType: "nable-attendance",
        title: "Apex Logistics",
        leadStatus: "Warm",
        credentials: "No portal yet",
        demoStage: "None",
        followupDate: getRelativeDate(3),
        installed: "No",
        contactPerson: "Rajesh Kumar (Operations Head)",
        billingDetails: "Under discussion (Targeting Rs 45,000 bulk deal)",
        assignedTo: "Self",
        status: "in-progress",
        priority: "high",
        hasDependency: true,
        dependencyPerson: "Rajesh Kumar (Client)",
        dependencyIssue: "Waiting for them to share list of locations & count of branch devices.",
        description: "Multi-branch logistics tracking. Needs sync with centralized database server.",
        tags: ["lead", "multibranch"],
        history: [
            { timestamp: getRelativeDate(-4) + " 04:00 PM", user: "System", message: "Warm lead logged after call." }
        ]
    },

    // --- BNI Tasks ---
    {
        id: "bni-1",
        projectType: "bni-tasks",
        title: "Follow up with Rohan Sen (Real Estate)",
        bniMeetingDate: getRelativeDate(-1),
        bniDeadline: getRelativeDate(5),
        bniAssignedBy: "Vikram Mehta (Architect)",
        bniReferral: "Rohan Sen (Needs SEO for listings)",
        status: "in-progress",
        priority: "high",
        assignedTo: "Self",
        followupDate: todayStr,
        hasDependency: false,
        dependencyPerson: "",
        dependencyIssue: "",
        description: "Vikram Mehta gave this referral at the Thursday chapter meeting. Rohan wants to audit his current website's SEO health.",
        tags: ["bni-referral", "seo", "contact-made"],
        history: [
            { timestamp: getRelativeDate(-1) + " 09:30 AM", user: "System", message: "BNI Referral created from sheet." }
        ]
    },
    {
        id: "bni-2",
        projectType: "bni-tasks",
        title: "Prep 60-Second Weekly Presentation",
        bniMeetingDate: getRelativeDate(0),
        bniDeadline: getRelativeDate(4),
        bniAssignedBy: "Self",
        bniReferral: "N/A",
        status: "not-started",
        priority: "medium",
        assignedTo: "Self",
        followupDate: getRelativeDate(2),
        hasDependency: false,
        dependencyPerson: "",
        dependencyIssue: "",
        description: "Draft a pitch focusing on Nable attendance software for manufacturing units and small factories.",
        tags: ["weekly-meeting", "pitch-prep"],
        history: [
            { timestamp: getRelativeDate(0) + " 08:00 AM", user: "System", message: "BNI task added." }
        ]
    },
    {
        id: "bni-3",
        projectType: "bni-tasks",
        title: "1-to-1 with Shivani Garg (Financial Planner)",
        bniMeetingDate: getRelativeDate(-3),
        bniDeadline: getRelativeDate(3),
        bniAssignedBy: "Shivani Garg",
        bniReferral: "Mutual learning",
        status: "completed",
        priority: "low",
        assignedTo: "Self",
        followupDate: yesterdayStr,
        hasDependency: false,
        dependencyPerson: "",
        dependencyIssue: "",
        description: "Scheduled online 1-to-1 to discuss business overlaps and understand client profiles.",
        tags: ["one-to-one", "networking"],
        history: [
            { timestamp: getRelativeDate(-3) + " 11:00 AM", user: "System", message: "1-to-1 logged." },
            { timestamp: yesterdayStr + " 04:30 PM", user: "Self", message: "Completed 1-to-1. Understood she targets families needing tax planning. Will keep an eye out." }
        ]
    }
];

class SalesStore {
    constructor() {
        this.tasks = [];
        this.init();
    }

    init() {
        const stored = localStorage.getItem('salesflow_tasks');
        if (stored) {
            try {
                this.tasks = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse stored tasks, resetting...", e);
                this.tasks = [...defaultTasks];
                this.saveToStorage();
            }
        } else {
            this.tasks = [...defaultTasks];
            this.saveToStorage();
        }
    }

    saveToStorage() {
        localStorage.setItem('salesflow_tasks', JSON.stringify(this.tasks));
        // Dispatch custom event to notify other modules of updates
        window.dispatchEvent(new CustomEvent('store-updated'));
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
            
            // Check project-specific fields
            if (taskData.projectType === 'digital-marketing') {
                if (task.currentStage !== taskData.currentStage) {
                    logs.push(`Stage updated to '${taskData.currentStage}'.`);
                }
                if (task.nextAction !== taskData.nextAction && taskData.nextAction) {
                    logs.push(`Next action updated: '${taskData.nextAction}'.`);
                }
            } else if (taskData.projectType === 'nable-attendance') {
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
                return true;
            }
        } catch (e) {
            console.error("Failed to import tasks:", e);
        }
        return false;
    }
}

export const store = new SalesStore();
