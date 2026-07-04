const supabase = require("../config/supabaseClient");

exports.getAllRoles = async (req, res) => {
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    
    // Map Supabase Auth users to frontend format
    const formattedUsers = users.map(u => ({
      _id: u.id,
      firstName: u.user_metadata?.firstName || "",
      lastName: u.user_metadata?.lastName || "",
      email: u.email,
      permissions: u.user_metadata?.permissions || []
    }));

    res.status(200).json({ success: true, data: formattedUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRole = async (req, res) => {
  try {
    const { firstName, lastName, email, password, permissions } = req.body;
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName,
        permissions: permissions || []
      }
    });

    if (error) throw error;
    res.status(201).json({ success: true, data: data.user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { password, permissions, firstName, lastName } = req.body;
    
    // First fetch existing user to preserve other metadata
    const { data: { user }, error: fetchError } = await supabase.auth.admin.getUserById(req.params.id);
    if (fetchError) throw fetchError;

    const updateData = {};
    if (password && password.trim() !== "") updateData.password = password;
    
    // Merge new metadata with existing
    const newMetadata = { ...user.user_metadata };
    if (permissions) newMetadata.permissions = permissions;
    if (firstName) newMetadata.firstName = firstName;
    if (lastName) newMetadata.lastName = lastName;
    
    updateData.user_metadata = newMetadata;
    
    const { data, error } = await supabase.auth.admin.updateUserById(req.params.id, updateData);
    if (error) throw error;
    
    res.status(200).json({ success: true, data: data.user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    // Protect superadmin from deletion just in case
    const { data: { user }, error: fetchError } = await supabase.auth.admin.getUserById(id);
    if (fetchError) throw fetchError;
    if (user.email === "ausosys@gmail.com") {
      return res.status(403).json({ success: false, message: "Superadmin cannot be deleted." });
    }

    const { data, error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
