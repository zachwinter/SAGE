use std::collections::HashMap;

pub struct User {
    pub id: u32,
    pub name: String,
    pub email: Option<String>,
}

pub enum UserStatus {
    Active,
    Inactive,
    Pending,
}

impl User {
    pub fn new(id: u32, name: String) -> Self {
        User {
            id,
            name,
            email: None,
        }
    }

    pub fn set_email(&mut self, email: String) {
        self.email = Some(email);
    }

    pub fn is_valid(&self) -> bool {
        !self.name.is_empty() && self.id > 0
    }
}

pub fn validate_email(email: &str) -> bool {
    email.contains('@') && email.contains('.')
}

pub fn create_user_map() -> HashMap<u32, User> {
    let mut users = HashMap::new();

    let user1 = User::new(1, "Alice".to_string());
    let user2 = User::new(2, "Bob".to_string());

    users.insert(user1.id, user1);
    users.insert(user2.id, user2);

    users
}

fn helper_function() -> String {
    "helper".to_string()
}
