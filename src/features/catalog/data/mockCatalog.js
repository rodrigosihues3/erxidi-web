export const mockCategories = [
  { id: 1, name: "Bóxers", slug: "boxers" },
  { id: 2, name: "Calzoncillos / Slips", slug: "calzoncillos-slips" },
  { id: 3, name: "Calzones / Trusas", slug: "calzones" },
  { id: 4, name: "Brasiers / Tops", slug: "brasiers" },
  { id: 5, name: "Medias", slug: "medias" },
];

export const mockMaterials = [
  { id: 1, name: "100% Algodón Pima" },
  { id: 2, name: "Modal Ultra-Suave" },
  { id: 3, name: "Bambú Antibacteriano" },
];

export const mockProducts = [
  // 1. Bóxer Hombre
  {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Bóxer Trunk Anatómico Pima",
    slug: "boxer-trunk-anatomico-pima",
    description:
      "Corte anatómico trunk con elástico afelpado suave anti-marcas. Confección en 100% algodón pima peinado de fibra larga para un soporte ergonómico superior.",
    price: 32.0,
    main_image_url:
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&q=80",
    gallery_urls: [
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80",
    ],
    target_gender: "hombre",
    has_size_guide: true,
    is_featured: true,
    is_active: true,
    categories: { id: 1, name: "Bóxers", slug: "boxers" },
    materials: { id: 1, name: "100% Algodón Pima" },
    size_guides: [
      {
        size: "S",
        measurements: { waist_min: 71, waist_max: 76, hip_min: 86, hip_max: 91 },
      },
      {
        size: "M",
        measurements: { waist_min: 77, waist_max: 84, hip_min: 92, hip_max: 99 },
      },
      {
        size: "L",
        measurements: { waist_min: 85, waist_max: 92, hip_min: 100, hip_max: 107 },
      },
      {
        size: "XL",
        measurements: { waist_min: 93, waist_max: 100, hip_min: 108, hip_max: 115 },
      },
    ],
    product_variants: [
      {
        id: "var-bx-01",
        color: "Negro Noche",
        color_hex: "#111827",
        stock: 8,
        sku: "BOX-PIM-NEG-S",
        is_active: true,
        sizes: { id: 1, name: "S", display_order: 1 },
      },
      {
        id: "var-bx-02",
        color: "Negro Noche",
        color_hex: "#111827",
        stock: 5,
        sku: "BOX-PIM-NEG-M",
        is_active: true,
        sizes: { id: 2, name: "M", display_order: 2 },
      },
      {
        id: "var-bx-03",
        color: "Negro Noche",
        color_hex: "#111827",
        stock: 0, // Caso límite: Agotado
        sku: "BOX-PIM-NEG-L",
        is_active: true,
        sizes: { id: 3, name: "L", display_order: 3 },
      },
      {
        id: "var-bx-04",
        color: "Azul Marino",
        color_hex: "#1E3A8A",
        stock: 4,
        sku: "BOX-PIM-AZU-M",
        is_active: true,
        sizes: { id: 2, name: "M", display_order: 2 },
      },
      {
        id: "var-bx-05",
        color: "Azul Marino",
        color_hex: "#1E3A8A",
        stock: 2, // Stock crítico
        sku: "BOX-PIM-AZU-L",
        is_active: true,
        sizes: { id: 3, name: "L", display_order: 3 },
      },
    ],
  },

  // 2. Calzón / Trusa Mujer
  {
    id: "a189f724-42b1-4f9e-a89b-90f772911b33",
    name: "Panty Clásico Modal Invisible",
    slug: "panty-clasico-modal-invisible",
    description:
      "Corte bikini de tiro medio con terminaciones ultra-planas libres de costuras opresivas. Confeccionado en modal ultra-suave respirable para una sensación de segunda piel.",
    price: 24.0,
    main_image_url:
      "https://images.unsplash.com/photo-1574015974293-817f0ebebb74?auto=format&fit=crop&w=600&q=80",
    gallery_urls: [
      "https://images.unsplash.com/photo-1574015974293-817f0ebebb74?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80",
    ],
    target_gender: "mujer",
    has_size_guide: true,
    is_featured: true,
    is_active: true,
    categories: { id: 3, name: "Calzones / Trusas", slug: "calzones" },
    materials: { id: 2, name: "Modal Ultra-Suave" },
    size_guides: [
      {
        size: "S",
        measurements: { waist_min: 64, waist_max: 69, hip_min: 90, hip_max: 95 },
      },
      {
        size: "M",
        measurements: { waist_min: 70, waist_max: 75, hip_min: 96, hip_max: 101 },
      },
      {
        size: "L",
        measurements: { waist_min: 76, waist_max: 82, hip_min: 102, hip_max: 108 },
      },
      {
        size: "XL",
        measurements: { waist_min: 83, waist_max: 90, hip_min: 109, hip_max: 116 },
      },
    ],
    product_variants: [
      {
        id: "var-tr-01",
        color: "Palo Rosa",
        color_hex: "#F472B6",
        stock: 6,
        sku: "PAN-MOD-ROS-S",
        is_active: true,
        sizes: { id: 1, name: "S", display_order: 1 },
      },
      {
        id: "var-tr-02",
        color: "Palo Rosa",
        color_hex: "#F472B6",
        stock: 7,
        sku: "PAN-MOD-ROS-M",
        is_active: true,
        sizes: { id: 2, name: "M", display_order: 2 },
      },
      {
        id: "var-tr-03",
        color: "Nude Natural",
        color_hex: "#E5D0BA",
        stock: 5,
        sku: "PAN-MOD-NUD-M",
        is_active: true,
        sizes: { id: 2, name: "M", display_order: 2 },
      },
      {
        id: "var-tr-04",
        color: "Nude Natural",
        color_hex: "#E5D0BA",
        stock: 3,
        sku: "PAN-MOD-NUD-L",
        is_active: true,
        sizes: { id: 3, name: "L", display_order: 3 },
      },
      {
        id: "var-tr-05",
        color: "Negro Noche",
        color_hex: "#111827",
        stock: 0, // Agotado
        sku: "PAN-MOD-NEG-XL",
        is_active: true,
        sizes: { id: 4, name: "XL", display_order: 4 },
      },
    ],
  },

  // 3. Brasier / Top Mujer
  {
    id: "b293c835-53c2-4a0f-b90c-01a883022c44",
    name: "Bralette Soft Confort Bambú",
    slug: "bralette-soft-confort-bambu",
    description:
      "Top bralette sin aros con copas extraíbles y soporte elástico afelpado. Tejido en fibra de bambú antibacteriano y termo-regulador para una comodidad total durante todo el día.",
    price: 45.0,
    main_image_url:
      "https://images.unsplash.com/photo-1506152983158-b4a74a01c721?auto=format&fit=crop&w=600&q=80",
    gallery_urls: [
      "https://images.unsplash.com/photo-1506152983158-b4a74a01c721?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80",
    ],
    target_gender: "mujer",
    has_size_guide: true,
    is_featured: true,
    is_active: true,
    categories: { id: 4, name: "Brasiers / Tops", slug: "brasiers" },
    materials: { id: 3, name: "Bambú Antibacteriano" },
    size_guides: [
      {
        size: "S",
        measurements: {
          underbust_min: 68,
          underbust_max: 72,
          bust_min: 82,
          bust_max: 86,
        },
      },
      {
        size: "M",
        measurements: {
          underbust_min: 73,
          underbust_max: 77,
          bust_min: 87,
          bust_max: 92,
        },
      },
      {
        size: "L",
        measurements: {
          underbust_min: 78,
          underbust_max: 82,
          bust_min: 93,
          bust_max: 98,
        },
      },
      {
        size: "XL",
        measurements: {
          underbust_min: 83,
          underbust_max: 88,
          bust_min: 99,
          bust_max: 105,
        },
      },
    ],
    product_variants: [
      {
        id: "var-br-01",
        color: "Blanco Crudo",
        color_hex: "#F8FAFC",
        stock: 4,
        sku: "BRA-BAM-BLA-S",
        is_active: true,
        sizes: { id: 1, name: "S", display_order: 1 },
      },
      {
        id: "var-br-02",
        color: "Blanco Crudo",
        color_hex: "#F8FAFC",
        stock: 5,
        sku: "BRA-BAM-BLA-M",
        is_active: true,
        sizes: { id: 2, name: "M", display_order: 2 },
      },
      {
        id: "var-br-03",
        color: "Negro Noche",
        color_hex: "#111827",
        stock: 6,
        sku: "BRA-BAM-NEG-M",
        is_active: true,
        sizes: { id: 2, name: "M", display_order: 2 },
      },
      {
        id: "var-br-04",
        color: "Negro Noche",
        color_hex: "#111827",
        stock: 3,
        sku: "BRA-BAM-NEG-L",
        is_active: true,
        sizes: { id: 3, name: "L", display_order: 3 },
      },
    ],
  },

  // 4. Pack de Medias Unisex
  {
    id: "c304d946-64d3-4b10-ca1d-12b994133d55",
    name: "Pack x3 Medias Invisibles Bambú",
    slug: "pack-3-medias-invisibles-bambu",
    description:
      "Pack de 3 pares de medias invisibles anti-deslizantes con banda de silicona interior en el talón. Fibra de bambú hipoalergénica con control natural de humedad y olores.",
    price: 29.0,
    main_image_url:
      "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=600&q=80",
    gallery_urls: [
      "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1582966772680-860e372bb558?auto=format&fit=crop&w=600&q=80",
    ],
    target_gender: "unisex",
    has_size_guide: true,
    is_featured: false,
    is_active: true,
    categories: { id: 5, name: "Medias", slug: "medias" },
    materials: { id: 3, name: "Bambú Antibacteriano" },
    size_guides: [
      {
        size: "S",
        measurements: { foot_length_min: 22, foot_length_max: 24 },
      },
      {
        size: "M",
        measurements: { foot_length_min: 24.5, foot_length_max: 26.5 },
      },
      {
        size: "L",
        measurements: { foot_length_min: 27, foot_length_max: 29 },
      },
    ],
    product_variants: [
      {
        id: "var-md-01",
        color: "Negro Noche",
        color_hex: "#111827",
        stock: 12,
        sku: "MED-BAM-NEG-S",
        is_active: true,
        sizes: { id: 1, name: "S", display_order: 1 },
      },
      {
        id: "var-md-02",
        color: "Negro Noche",
        color_hex: "#111827",
        stock: 15,
        sku: "MED-BAM-NEG-M",
        is_active: true,
        sizes: { id: 2, name: "M", display_order: 2 },
      },
      {
        id: "var-md-03",
        color: "Blanco Puro",
        color_hex: "#F1F5F9",
        stock: 9,
        sku: "MED-BAM-BLA-M",
        is_active: true,
        sizes: { id: 2, name: "M", display_order: 2 },
      },
      {
        id: "var-md-04",
        color: "Blanco Puro",
        color_hex: "#F1F5F9",
        stock: 6,
        sku: "MED-BAM-BLA-L",
        is_active: true,
        sizes: { id: 3, name: "L", display_order: 3 },
      },
    ],
  },

  // 5. Bóxer / Calzoncillo Niño
  {
    id: "d415ea57-75e4-4c21-db2e-23ca05244e66",
    name: "Bóxer Niño Confort Pima",
    slug: "boxer-nino-confort-pima",
    description:
      "Bóxer para niño confeccionado en 100% algodón pima peruano. Costuras planas reforzadas y elástico afelpado suave que no irrita ni presiona la piel infantil.",
    price: 22.0,
    main_image_url:
      "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=600&q=80",
    gallery_urls: [
      "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&w=600&q=80",
    ],
    target_gender: "nino",
    has_size_guide: true,
    is_featured: false,
    is_active: true,
    categories: { id: 1, name: "Bóxers", slug: "boxers" },
    materials: { id: 1, name: "100% Algodón Pima" },
    size_guides: [
      {
        size: "4-6",
        measurements: { waist_min: 52, waist_max: 56, hip_min: 58, hip_max: 63 },
      },
      {
        size: "8-10",
        measurements: { waist_min: 57, waist_max: 62, hip_min: 64, hip_max: 71 },
      },
      {
        size: "12-14",
        measurements: { waist_min: 63, waist_max: 68, hip_min: 72, hip_max: 79 },
      },
    ],
    product_variants: [
      {
        id: "var-ni-01",
        color: "Azul Marino",
        color_hex: "#1E3A8A",
        stock: 5,
        sku: "NIN-PIM-AZU-4",
        is_active: true,
        sizes: { id: 10, name: "4-6", display_order: 1 },
      },
      {
        id: "var-ni-02",
        color: "Azul Marino",
        color_hex: "#1E3A8A",
        stock: 4,
        sku: "NIN-PIM-AZU-8",
        is_active: true,
        sizes: { id: 11, name: "8-10", display_order: 2 },
      },
      {
        id: "var-ni-03",
        color: "Gris Jaspe",
        color_hex: "#64748B",
        stock: 6,
        sku: "NIN-PIM-GRI-8",
        is_active: true,
        sizes: { id: 11, name: "8-10", display_order: 2 },
      },
      {
        id: "var-ni-04",
        color: "Gris Jaspe",
        color_hex: "#64748B",
        stock: 2,
        sku: "NIN-PIM-GRI-12",
        is_active: true,
        sizes: { id: 12, name: "12-14", display_order: 3 },
      },
    ],
  },
];

