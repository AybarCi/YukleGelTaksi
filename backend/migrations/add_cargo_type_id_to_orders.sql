-- Add cargo_type_id column to orders table
ALTER TABLE orders
ADD cargo_type_id INT NULL;

-- Add foreign key constraint
ALTER TABLE orders
ADD CONSTRAINT fk_orders_cargo_types
FOREIGN KEY (cargo_type_id) REFERENCES cargo_types(id);

-- Add base_labor_count to track original labor count from cargo type
ALTER TABLE orders
ADD base_labor_count INT NULL;

-- Create index for better query performance
CREATE INDEX idx_orders_cargo_type_id ON orders(cargo_type_id);