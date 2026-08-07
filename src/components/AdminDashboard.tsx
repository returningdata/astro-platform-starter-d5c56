import { useState, useEffect } from "react";

interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  permissions: string[];
}

interface ContentItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  image?: string;
}

interface AdminRole {
  roleId: string;
  roleName: string;
  permissions: string[];
}

interface Conversation {
  id: string;
  messages: ChatMessage[];
  isAdminTakeover: boolean;
  adminName?: string;
  lastActivity: string;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot" | "admin";
  adminName?: string;
  timestamp: string;
}

interface BotConfig {
  responses: Record<string, string>;
  fallbackResponse: string;
  enableAI: boolean;
}

type TabType = "dashboard" | "skills" | "tools" | "bots" | "services" | "roles" | "chatbot";

const AVAILABLE_PERMISSIONS = [
  { id: "all", label: "All Permissions" },
  { id: "manage_skills", label: "Manage Skills" },
  { id: "manage_tools", label: "Manage Tools" },
  { id: "manage_bots", label: "Manage Bots" },
  { id: "manage_services", label: "Manage Services" },
  { id: "manage_chat", label: "Manage Chat / Take Over" }
];

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  // Content state
  const [skills, setSkills] = useState<ContentItem[]>([]);
  const [tools, setTools] = useState<ContentItem[]>([]);
  const [bots, setBots] = useState<ContentItem[]>([]);
  const [services, setServices] = useState<ContentItem[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [adminMessage, setAdminMessage] = useState("");
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);

  // Form state
  const [newItem, setNewItem] = useState({ name: "", description: "", icon: "", image: "" });
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [newRole, setNewRole] = useState({ roleId: "", roleName: "", permissions: [] as string[] });

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();

      if (data.authenticated && data.user.isAdmin) {
        setUser(data.user);
        loadAllContent();
      } else {
        window.location.href = "/?error=not_admin";
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      window.location.href = "/?error=auth_failed";
    } finally {
      setLoading(false);
    }
  }

  async function loadAllContent() {
    await Promise.all([
      loadContent("skills"),
      loadContent("tools"),
      loadContent("bots"),
      loadContent("services"),
      loadRoles(),
      loadConversations(),
      loadBotConfig()
    ]);
  }

  async function loadContent(type: string) {
    try {
      const res = await fetch(`/api/admin/${type}`);
      const data = await res.json();
      switch (type) {
        case "skills":
          setSkills(data.skills || []);
          break;
        case "tools":
          setTools(data.tools || []);
          break;
        case "bots":
          setBots(data.bots || []);
          break;
        case "services":
          setServices(data.services || []);
          break;
      }
    } catch (error) {
      console.error(`Failed to load ${type}:`, error);
    }
  }

  async function loadRoles() {
    try {
      const res = await fetch("/api/admin/roles");
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error("Failed to load roles:", error);
    }
  }

  async function loadConversations() {
    try {
      const res = await fetch("/api/chat?action=list");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  }

  async function loadBotConfig() {
    try {
      const res = await fetch("/api/chat?action=config");
      if (res.ok) {
        const data = await res.json();
        setBotConfig(data.config);
      }
    } catch (error) {
      console.error("Failed to load bot config:", error);
    }
  }

  async function handleAddItem(type: string) {
    if (!newItem.name.trim()) return;

    try {
      const res = await fetch(`/api/admin/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem)
      });

      if (res.ok) {
        setNewItem({ name: "", description: "", icon: "", image: "" });
        loadContent(type);
      }
    } catch (error) {
      console.error(`Failed to add ${type}:`, error);
    }
  }

  async function handleUpdateItem(type: string) {
    if (!editingItem) return;

    try {
      const res = await fetch(`/api/admin/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem)
      });

      if (res.ok) {
        setEditingItem(null);
        loadContent(type);
      }
    } catch (error) {
      console.error(`Failed to update ${type}:`, error);
    }
  }

  async function handleDeleteItem(type: string, id: string) {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const res = await fetch(`/api/admin/${type}?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadContent(type);
      }
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
    }
  }

  async function handleAddRole() {
    if (!newRole.roleId.trim() || !newRole.roleName.trim()) return;

    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole)
      });

      if (res.ok) {
        setNewRole({ roleId: "", roleName: "", permissions: [] });
        loadRoles();
      }
    } catch (error) {
      console.error("Failed to add role:", error);
    }
  }

  async function handleDeleteRole(roleId: string) {
    if (!confirm("Are you sure you want to delete this role?")) return;

    try {
      const res = await fetch(`/api/admin/roles?roleId=${roleId}`, { method: "DELETE" });
      if (res.ok) {
        loadRoles();
      }
    } catch (error) {
      console.error("Failed to delete role:", error);
    }
  }

  async function handleTakeover(conversationId: string, release: boolean = false) {
    try {
      const res = await fetch("/api/chat?action=takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, release })
      });

      if (res.ok) {
        loadConversations();
        if (selectedConversation?.id === conversationId) {
          const data = await res.json();
          setSelectedConversation(data.conversation);
        }
      }
    } catch (error) {
      console.error("Failed to takeover:", error);
    }
  }

  async function handleSendAdminMessage() {
    if (!selectedConversation || !adminMessage.trim()) return;

    try {
      const res = await fetch("/api/chat?action=admin-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          message: adminMessage
        })
      });

      if (res.ok) {
        setAdminMessage("");
        loadConversations();
        // Refresh selected conversation
        const convRes = await fetch("/api/chat?action=list");
        const data = await convRes.json();
        const updated = data.conversations.find(
          (c: Conversation) => c.id === selectedConversation.id
        );
        if (updated) setSelectedConversation(updated);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }

  async function handleUpdateBotConfig() {
    if (!botConfig) return;

    try {
      const res = await fetch("/api/chat?action=config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(botConfig)
      });

      if (res.ok) {
        alert("Bot configuration updated!");
      }
    } catch (error) {
      console.error("Failed to update bot config:", error);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout");
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  function renderContentManager(type: string, items: ContentItem[]) {
    const typeSingular = type.slice(0, -1);

    return (
      <div className="admin-content-manager">
        <h2>Manage {type.charAt(0).toUpperCase() + type.slice(1)}</h2>

        <div className="admin-form">
          <h3>Add New {typeSingular.charAt(0).toUpperCase() + typeSingular.slice(1)}</h3>
          <input
            type="text"
            placeholder="Name"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          />
          <textarea
            placeholder="Description (optional)"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
          />
          {(type === "bots" || type === "services") && (
            <input
              type="text"
              placeholder="Image URL (optional)"
              value={newItem.image}
              onChange={(e) => setNewItem({ ...newItem, image: e.target.value })}
            />
          )}
          {(type === "skills" || type === "tools" || type === "services") && (
            <input
              type="text"
              placeholder="Icon SVG path (optional)"
              value={newItem.icon}
              onChange={(e) => setNewItem({ ...newItem, icon: e.target.value })}
            />
          )}
          <button className="btn-primary" onClick={() => handleAddItem(type)}>
            Add {typeSingular.charAt(0).toUpperCase() + typeSingular.slice(1)}
          </button>
        </div>

        <div className="admin-items-list">
          <h3>Current {type.charAt(0).toUpperCase() + type.slice(1)}</h3>
          {items.length === 0 ? (
            <p className="empty-message">No {type} added yet.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className="admin-item">
                  {editingItem?.id === item.id ? (
                    <div className="edit-form">
                      <input
                        type="text"
                        value={editingItem.name}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      />
                      <textarea
                        value={editingItem.description || ""}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, description: e.target.value })
                        }
                      />
                      <div className="edit-actions">
                        <button className="btn-primary" onClick={() => handleUpdateItem(type)}>
                          Save
                        </button>
                        <button className="btn-secondary" onClick={() => setEditingItem(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="item-info">
                        <strong>{item.name}</strong>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      <div className="item-actions">
                        <button className="btn-edit" onClick={() => setEditingItem(item)}>
                          Edit
                        </button>
                        <button className="btn-delete" onClick={() => handleDeleteItem(type, item.id)}>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  function renderRolesManager() {
    if (!user?.isOwner) {
      return <p>Only owners can manage roles.</p>;
    }

    return (
      <div className="admin-content-manager">
        <h2>Manage Admin Roles</h2>
        <p className="info-text">
          Add Discord role IDs to grant admin access. Users with these roles will have the
          specified permissions.
        </p>

        <div className="admin-form">
          <h3>Add New Role</h3>
          <input
            type="text"
            placeholder="Discord Role ID"
            value={newRole.roleId}
            onChange={(e) => setNewRole({ ...newRole, roleId: e.target.value })}
          />
          <input
            type="text"
            placeholder="Role Name (for display)"
            value={newRole.roleName}
            onChange={(e) => setNewRole({ ...newRole, roleName: e.target.value })}
          />
          <div className="permissions-checkboxes">
            <label>Permissions:</label>
            {AVAILABLE_PERMISSIONS.map((perm) => (
              <label key={perm.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={newRole.permissions.includes(perm.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setNewRole({ ...newRole, permissions: [...newRole.permissions, perm.id] });
                    } else {
                      setNewRole({
                        ...newRole,
                        permissions: newRole.permissions.filter((p) => p !== perm.id)
                      });
                    }
                  }}
                />
                {perm.label}
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={handleAddRole}>
            Add Role
          </button>
        </div>

        <div className="admin-items-list">
          <h3>Current Roles</h3>
          {roles.length === 0 ? (
            <p className="empty-message">No roles configured.</p>
          ) : (
            <ul>
              {roles.map((role) => (
                <li key={role.roleId} className="admin-item">
                  <div className="item-info">
                    <strong>{role.roleName}</strong>
                    <p>Role ID: {role.roleId}</p>
                    <p>Permissions: {role.permissions.join(", ")}</p>
                  </div>
                  <div className="item-actions">
                    {role.roleId !== "1411715697888989286" && (
                      <button className="btn-delete" onClick={() => handleDeleteRole(role.roleId)}>
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  function renderChatManager() {
    return (
      <div className="admin-chat-manager">
        <h2>Chat Management</h2>

        <div className="chat-layout">
          <div className="conversations-list">
            <h3>Active Conversations</h3>
            <button className="btn-secondary refresh-btn" onClick={loadConversations}>
              Refresh
            </button>
            {conversations.length === 0 ? (
              <p className="empty-message">No active conversations.</p>
            ) : (
              <ul>
                {conversations.map((conv) => (
                  <li
                    key={conv.id}
                    className={`conversation-item ${selectedConversation?.id === conv.id ? "selected" : ""} ${conv.isAdminTakeover ? "takeover" : ""}`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="conv-info">
                      <span className="conv-id">
                        {conv.id.substring(0, 8)}...
                      </span>
                      <span className="conv-messages">{conv.messages.length} messages</span>
                      {conv.isAdminTakeover && (
                        <span className="takeover-badge">Admin: {conv.adminName}</span>
                      )}
                    </div>
                    <span className="conv-time">
                      {new Date(conv.lastActivity).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="conversation-view">
            {selectedConversation ? (
              <>
                <div className="conv-header">
                  <h3>Conversation {selectedConversation.id.substring(0, 8)}...</h3>
                  <div className="conv-actions">
                    {selectedConversation.isAdminTakeover ? (
                      <button
                        className="btn-secondary"
                        onClick={() => handleTakeover(selectedConversation.id, true)}
                      >
                        Release Control
                      </button>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() => handleTakeover(selectedConversation.id)}
                      >
                        Take Over
                      </button>
                    )}
                  </div>
                </div>

                <div className="messages-container">
                  {selectedConversation.messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.sender}`}>
                      <span className="sender">
                        {msg.sender === "user"
                          ? "User"
                          : msg.sender === "admin"
                            ? msg.adminName || "Admin"
                            : "KRUIGER AI"}
                      </span>
                      <p>{msg.text}</p>
                      <span className="time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>

                {selectedConversation.isAdminTakeover && (
                  <div className="admin-reply">
                    <input
                      type="text"
                      placeholder="Type your message..."
                      value={adminMessage}
                      onChange={(e) => setAdminMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSendAdminMessage()}
                    />
                    <button className="btn-primary" onClick={handleSendAdminMessage}>
                      Send
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="empty-message">Select a conversation to view</p>
            )}
          </div>
        </div>

        {user?.isOwner && botConfig && (
          <div className="bot-config">
            <h3>Bot Configuration</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={botConfig.enableAI}
                onChange={(e) => setBotConfig({ ...botConfig, enableAI: e.target.checked })}
              />
              Enable AI Responses (requires OPENAI_API_KEY env variable)
            </label>
            <div className="config-field">
              <label>Fallback Response:</label>
              <textarea
                value={botConfig.fallbackResponse}
                onChange={(e) => setBotConfig({ ...botConfig, fallbackResponse: e.target.value })}
              />
            </div>
            <button className="btn-primary" onClick={handleUpdateBotConfig}>
              Save Bot Config
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        .admin-container {
          min-height: 100vh;
          background: radial-gradient(circle at top, #0d0d12, #07070a);
          color: #F1F1F3;
          font-family: Inter, system-ui, sans-serif;
        }

        .admin-header {
          padding: 20px 40px;
          background: rgba(7, 7, 10, 0.92);
          border-bottom: 1px solid rgba(168, 85, 247, 0.25);
          display: flex;
          justify-content: space-between;
          align-items: center;
          backdrop-filter: blur(12px);
        }

        .admin-logo {
          font-family: Orbitron, system-ui;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .admin-logo span { color: #A855F7; }

        .admin-user {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .admin-user img {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid rgba(168, 85, 247, 0.5);
        }

        .admin-user-info {
          text-align: right;
        }

        .admin-user-name {
          font-weight: 600;
        }

        .admin-user-role {
          font-size: 12px;
          color: #A855F7;
        }

        .btn-logout {
          padding: 8px 16px;
          background: transparent;
          border: 1px solid rgba(255, 100, 100, 0.5);
          color: #ff6b6b;
          border-radius: 6px;
          cursor: pointer;
          transition: 0.2s;
        }

        .btn-logout:hover {
          background: rgba(255, 100, 100, 0.1);
          border-color: #ff6b6b;
        }

        .admin-layout {
          display: flex;
          min-height: calc(100vh - 81px);
        }

        .admin-sidebar {
          width: 240px;
          background: rgba(18, 18, 25, 0.86);
          border-right: 1px solid rgba(168, 85, 247, 0.15);
          padding: 20px 0;
        }

        .admin-nav {
          list-style: none;
        }

        .admin-nav li {
          margin: 4px 12px;
        }

        .admin-nav button {
          width: 100%;
          padding: 12px 20px;
          background: transparent;
          border: none;
          color: #A1A1AA;
          text-align: left;
          font-size: 14px;
          cursor: pointer;
          border-radius: 8px;
          transition: 0.2s;
        }

        .admin-nav button:hover {
          background: rgba(168, 85, 247, 0.1);
          color: #F1F1F3;
        }

        .admin-nav button.active {
          background: rgba(168, 85, 247, 0.15);
          color: #A855F7;
          border-left: 3px solid #A855F7;
        }

        .admin-main {
          flex: 1;
          padding: 30px 40px;
          overflow-y: auto;
        }

        .admin-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: radial-gradient(circle at top, #0d0d12, #07070a);
          color: #F1F1F3;
        }

        .admin-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid rgba(168, 85, 247, 0.2);
          border-top-color: #A855F7;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .admin-dashboard h1 {
          font-family: Orbitron, system-ui;
          font-size: 28px;
          margin-bottom: 30px;
        }

        .admin-dashboard h1 span { color: #A855F7; }

        .dashboard-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .stat-card {
          padding: 24px;
          background: rgba(15, 15, 22, 0.82);
          border: 1px solid rgba(168, 85, 247, 0.25);
          border-radius: 12px;
          text-align: center;
        }

        .stat-card h3 {
          font-size: 36px;
          color: #A855F7;
          margin-bottom: 8px;
        }

        .stat-card p {
          color: #A1A1AA;
          font-size: 14px;
        }

        .admin-content-manager h2 {
          font-family: Orbitron, system-ui;
          font-size: 24px;
          margin-bottom: 24px;
        }

        .admin-form {
          background: rgba(15, 15, 22, 0.82);
          border: 1px solid rgba(168, 85, 247, 0.25);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 30px;
        }

        .admin-form h3 {
          font-size: 18px;
          margin-bottom: 16px;
          color: #F1F1F3;
        }

        .admin-form input,
        .admin-form textarea {
          width: 100%;
          padding: 12px 16px;
          margin-bottom: 12px;
          background: rgba(24, 24, 33, 0.92);
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: 8px;
          color: #F1F1F3;
          font-size: 14px;
          outline: none;
          transition: 0.2s;
        }

        .admin-form input:focus,
        .admin-form textarea:focus {
          border-color: rgba(168, 85, 247, 0.5);
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.15);
        }

        .admin-form textarea {
          min-height: 80px;
          resize: vertical;
        }

        .btn-primary {
          padding: 12px 24px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(168, 85, 247, 0.1));
          border: 1px solid rgba(168, 85, 247, 0.4);
          color: #F1F1F3;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: 0.2s;
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(168, 85, 247, 0.2));
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
        }

        .btn-secondary {
          padding: 12px 24px;
          background: transparent;
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #A1A1AA;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: 0.2s;
        }

        .btn-secondary:hover {
          border-color: rgba(168, 85, 247, 0.5);
          color: #F1F1F3;
        }

        .admin-items-list {
          background: rgba(15, 15, 22, 0.82);
          border: 1px solid rgba(168, 85, 247, 0.25);
          border-radius: 12px;
          padding: 24px;
        }

        .admin-items-list h3 {
          font-size: 18px;
          margin-bottom: 16px;
          color: #F1F1F3;
        }

        .admin-items-list ul {
          list-style: none;
        }

        .admin-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: rgba(24, 24, 33, 0.66);
          border: 1px solid rgba(168, 85, 247, 0.15);
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .item-info strong {
          display: block;
          margin-bottom: 4px;
        }

        .item-info p {
          color: #A1A1AA;
          font-size: 13px;
        }

        .item-actions {
          display: flex;
          gap: 8px;
        }

        .btn-edit,
        .btn-delete {
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          transition: 0.2s;
        }

        .btn-edit {
          background: transparent;
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #A855F7;
        }

        .btn-edit:hover {
          background: rgba(168, 85, 247, 0.1);
        }

        .btn-delete {
          background: transparent;
          border: 1px solid rgba(255, 100, 100, 0.3);
          color: #ff6b6b;
        }

        .btn-delete:hover {
          background: rgba(255, 100, 100, 0.1);
        }

        .edit-form {
          width: 100%;
        }

        .edit-form input,
        .edit-form textarea {
          width: 100%;
          padding: 10px 14px;
          margin-bottom: 10px;
          background: rgba(24, 24, 33, 0.92);
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: 6px;
          color: #F1F1F3;
          font-size: 14px;
          outline: none;
        }

        .edit-actions {
          display: flex;
          gap: 8px;
        }

        .empty-message {
          color: #A1A1AA;
          text-align: center;
          padding: 20px;
        }

        .info-text {
          color: #A1A1AA;
          margin-bottom: 20px;
        }

        .permissions-checkboxes {
          margin-bottom: 16px;
        }

        .permissions-checkboxes > label {
          display: block;
          margin-bottom: 8px;
          color: #A1A1AA;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: #F1F1F3;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: #A855F7;
        }

        /* Chat Manager Styles */
        .admin-chat-manager h2 {
          font-family: Orbitron, system-ui;
          font-size: 24px;
          margin-bottom: 24px;
        }

        .chat-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }

        .conversations-list {
          background: rgba(15, 15, 22, 0.82);
          border: 1px solid rgba(168, 85, 247, 0.25);
          border-radius: 12px;
          padding: 20px;
          max-height: 600px;
          overflow-y: auto;
        }

        .conversations-list h3 {
          font-size: 16px;
          margin-bottom: 12px;
        }

        .refresh-btn {
          width: 100%;
          margin-bottom: 12px;
        }

        .conversations-list ul {
          list-style: none;
        }

        .conversation-item {
          padding: 12px;
          background: rgba(24, 24, 33, 0.66);
          border: 1px solid rgba(168, 85, 247, 0.15);
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: 0.2s;
        }

        .conversation-item:hover {
          border-color: rgba(168, 85, 247, 0.4);
        }

        .conversation-item.selected {
          border-color: #A855F7;
          background: rgba(168, 85, 247, 0.1);
        }

        .conversation-item.takeover {
          border-left: 3px solid #A855F7;
        }

        .conv-info {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 4px;
        }

        .conv-id {
          font-family: monospace;
          font-size: 12px;
        }

        .conv-messages {
          font-size: 12px;
          color: #A1A1AA;
        }

        .takeover-badge {
          font-size: 11px;
          padding: 2px 6px;
          background: rgba(168, 85, 247, 0.2);
          border-radius: 4px;
          color: #A855F7;
        }

        .conv-time {
          font-size: 11px;
          color: #A1A1AA;
        }

        .conversation-view {
          background: rgba(15, 15, 22, 0.82);
          border: 1px solid rgba(168, 85, 247, 0.25);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          max-height: 600px;
        }

        .conv-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(168, 85, 247, 0.15);
          margin-bottom: 16px;
        }

        .conv-header h3 {
          font-size: 16px;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 16px;
        }

        .message {
          padding: 12px 16px;
          margin-bottom: 12px;
          border-radius: 12px;
          max-width: 80%;
        }

        .message.user {
          background: rgba(168, 85, 247, 0.15);
          border: 1px solid rgba(168, 85, 247, 0.3);
          margin-left: auto;
        }

        .message.bot {
          background: rgba(24, 24, 33, 0.86);
          border: 1px solid rgba(168, 85, 247, 0.15);
        }

        .message.admin {
          background: rgba(100, 200, 100, 0.15);
          border: 1px solid rgba(100, 200, 100, 0.3);
        }

        .message .sender {
          font-size: 11px;
          color: #A855F7;
          display: block;
          margin-bottom: 4px;
        }

        .message p {
          font-size: 14px;
          line-height: 1.5;
        }

        .message .time {
          font-size: 10px;
          color: #A1A1AA;
          display: block;
          margin-top: 4px;
          text-align: right;
        }

        .admin-reply {
          display: flex;
          gap: 12px;
        }

        .admin-reply input {
          flex: 1;
          padding: 12px 16px;
          background: rgba(24, 24, 33, 0.92);
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: 8px;
          color: #F1F1F3;
          font-size: 14px;
          outline: none;
        }

        .admin-reply input:focus {
          border-color: rgba(168, 85, 247, 0.5);
        }

        .bot-config {
          background: rgba(15, 15, 22, 0.82);
          border: 1px solid rgba(168, 85, 247, 0.25);
          border-radius: 12px;
          padding: 24px;
        }

        .bot-config h3 {
          font-size: 18px;
          margin-bottom: 16px;
        }

        .config-field {
          margin: 16px 0;
        }

        .config-field label {
          display: block;
          margin-bottom: 8px;
          color: #A1A1AA;
        }

        .config-field textarea {
          width: 100%;
          padding: 12px 16px;
          background: rgba(24, 24, 33, 0.92);
          border: 1px solid rgba(168, 85, 247, 0.2);
          border-radius: 8px;
          color: #F1F1F3;
          font-size: 14px;
          min-height: 100px;
          resize: vertical;
          outline: none;
        }

        @media (max-width: 900px) {
          .admin-layout {
            flex-direction: column;
          }

          .admin-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid rgba(168, 85, 247, 0.15);
          }

          .admin-nav {
            display: flex;
            flex-wrap: wrap;
            padding: 0 12px;
          }

          .admin-nav li {
            margin: 4px;
          }

          .chat-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="admin-container">
        <header className="admin-header">
          <div className="admin-logo">
            KRUIGER<span>LABS</span> ADMIN
          </div>
          <div className="admin-user">
            {user.avatar && <img src={user.avatar} alt={user.displayName} />}
            <div className="admin-user-info">
              <div className="admin-user-name">{user.displayName}</div>
              <div className="admin-user-role">{user.isOwner ? "Owner" : "Admin"}</div>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="admin-layout">
          <aside className="admin-sidebar">
            <ul className="admin-nav">
              <li>
                <button
                  className={activeTab === "dashboard" ? "active" : ""}
                  onClick={() => setActiveTab("dashboard")}
                >
                  Dashboard
                </button>
              </li>
              <li>
                <button
                  className={activeTab === "skills" ? "active" : ""}
                  onClick={() => setActiveTab("skills")}
                >
                  Skills
                </button>
              </li>
              <li>
                <button
                  className={activeTab === "tools" ? "active" : ""}
                  onClick={() => setActiveTab("tools")}
                >
                  Tools
                </button>
              </li>
              <li>
                <button
                  className={activeTab === "bots" ? "active" : ""}
                  onClick={() => setActiveTab("bots")}
                >
                  Bots
                </button>
              </li>
              <li>
                <button
                  className={activeTab === "services" ? "active" : ""}
                  onClick={() => setActiveTab("services")}
                >
                  Services
                </button>
              </li>
              <li>
                <button
                  className={activeTab === "chatbot" ? "active" : ""}
                  onClick={() => setActiveTab("chatbot")}
                >
                  Chatbot
                </button>
              </li>
              {user.isOwner && (
                <li>
                  <button
                    className={activeTab === "roles" ? "active" : ""}
                    onClick={() => setActiveTab("roles")}
                  >
                    Roles
                  </button>
                </li>
              )}
            </ul>
          </aside>

          <main className="admin-main">
            {activeTab === "dashboard" && (
              <div className="admin-dashboard">
                <h1>
                  Welcome, <span>{user.displayName}</span>
                </h1>

                <div className="dashboard-stats">
                  <div className="stat-card">
                    <h3>{skills.length}</h3>
                    <p>Skills</p>
                  </div>
                  <div className="stat-card">
                    <h3>{tools.length}</h3>
                    <p>Tools</p>
                  </div>
                  <div className="stat-card">
                    <h3>{bots.length}</h3>
                    <p>Bots</p>
                  </div>
                  <div className="stat-card">
                    <h3>{services.length}</h3>
                    <p>Services</p>
                  </div>
                  <div className="stat-card">
                    <h3>{conversations.length}</h3>
                    <p>Active Chats</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "skills" && renderContentManager("skills", skills)}
            {activeTab === "tools" && renderContentManager("tools", tools)}
            {activeTab === "bots" && renderContentManager("bots", bots)}
            {activeTab === "services" && renderContentManager("services", services)}
            {activeTab === "roles" && renderRolesManager()}
            {activeTab === "chatbot" && renderChatManager()}
          </main>
        </div>
      </div>
    </>
  );
}
