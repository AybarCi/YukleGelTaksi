-- Create cargo types table
CREATE TABLE IF NOT EXISTS cargo_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX idx_cargo_types_active ON cargo_types(is_active);
CREATE INDEX idx_cargo_types_sort_order ON cargo_types(sort_order);

-- Insert default cargo types that match the mobile app
INSERT INTO cargo_types (name, description, sort_order) VALUES
    ('Mobilya', 'Mobilya ve ev eşyaları', 1),
    ('Beyaz Eşya', 'Beyaz eşya ve büyük ev aletleri', 2),
    ('Koli/Paket', 'Koli, paket ve küçük eşyalar', 3),
    ('Diğer', 'Diğer tüm yük türleri', 4)
ON CONFLICT (name) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cargo_types_updated_at
    BEFORE UPDATE ON cargo_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();