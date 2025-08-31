-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'basic',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  position VARCHAR(255),
  company_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'prospect',
  value INTEGER DEFAULT 0,
  notes TEXT,
  last_contact DATE DEFAULT CURRENT_DATE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  contact_name VARCHAR(255),
  value INTEGER DEFAULT 0,
  stage VARCHAR(50) DEFAULT 'lead',
  probability INTEGER DEFAULT 10 CHECK (probability >= 0 AND probability <= 100),
  expected_close DATE,
  source VARCHAR(100),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_expected_close ON leads(expected_close);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Insert demo company and user (for testing)
INSERT INTO companies (id, name, plan) 
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'Demo Company', 'basic') 
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash, name, company_id, role)
VALUES (
  '123e4567-e89b-12d3-a456-426614174001', 
  'demo@example.com', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: 'password'
  'Demo User', 
  '123e4567-e89b-12d3-a456-426614174000',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- Insert some sample contacts
INSERT INTO contacts (id, company_id, name, email, phone, company_name, position, status, value, notes) VALUES
('c1111111-1111-1111-1111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'John Smith', 'john@acmecorp.com', '+1-555-123-4567', 'Acme Corp', 'CEO', 'active', 50000, 'Key decision maker'),
('c2222222-2222-2222-2222-222222222222', '123e4567-e89b-12d3-a456-426614174000', 'Sarah Johnson', 'sarah@techstart.com', '+1-555-987-6543', 'TechStart Inc', 'CTO', 'prospect', 25000, 'Technical evaluation')
ON CONFLICT (id) DO NOTHING;

-- Insert some sample leads
INSERT INTO leads (id, company_id, title, company_name, contact_name, value, stage, probability, expected_close, source, notes) VALUES
('l1111111-1111-1111-1111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'Enterprise Software Deal', 'Global Industries', 'Mike Wilson', 75000, 'negotiation', 70, '2024-02-15', 'Website', 'Large enterprise deal'),
('l2222222-2222-2222-2222-222222222222', '123e4567-e89b-12d3-a456-426614174000', 'Small Business Package', 'Local Bakery', 'Lisa Chen', 5000, 'proposal', 50, '2024-01-30', 'Referral', 'Budget conscious client')
ON CONFLICT (id) DO NOTHING;

-- Insert some sample tasks
INSERT INTO tasks (id, company_id, contact_id, title, description, due_date, priority, status) VALUES
('t1111111-1111-1111-1111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'c1111111-1111-1111-1111-111111111111', 'Follow up with John Smith', 'Send proposal for enterprise package', '2024-01-20', 'high', 'pending'),
('t2222222-2222-2222-2222-222222222222', '123e4567-e89b-12d3-a456-426614174000', 'c2222222-2222-2222-2222-222222222222', 'Technical demo for TechStart', 'Schedule product demonstration', '2024-01-18', 'medium', 'pending')
ON CONFLICT (id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
