# **Polygot 🌐**

**Polygot** is a powerful React translation library designed for simplicity and efficiency. It offers intelligent context management and automatic content translation, making it easy to internationalize your application.

---

## 🚀 Quick Start

Get up and running with Polygot in just a few steps.

### **Installation**

Install the package from **npm**:

```bash
npm install Polygot
```

### **Basic Usage**

Wrap your main application component with the `PolygotProvider` and provide the necessary props:

```jsx
import { PolygotProvider } from 'Polygot';

function App() {
  return (
    <PolygotProvider
      sourceLanguage="en"
      apiKey="your-api-key"
    >
      <YourApp />
    </PolygotProvider>
  );
}
```

---

## ✨ Features

- **Automatic Translation**: Use the `<Polygot>` component to translate entire sections of your app automatically.
- **Selective Translation**: The `<NoPolygot>` component gives you control to exclude specific content from being translated.
- **Fine-Grained Control**: The `usePolygot` hook provides access to translation functions and language state for custom implementations.
- **Easy Setup**: The `PolygotProvider` makes configuration straightforward.

---

## 📚 API Reference

### 🔹 PolygotProvider

The main context provider that manages translation state for your application.

#### **Props**

| Prop             | Type       | Default       | Description                                                  |
|------------------|------------|----------------|--------------------------------------------------------------|
| `children`       | `ReactNode`| —              | Your application’s child components.                         |
| `sourceLanguage` | `string`   | `'en'`         | The original language of your content.                       |
| `apiKey`         | `string`   | —              | **Required**. Your API key for the translation service.      |
| `loadingComponent` | `ReactNode` | `"Loading..."` | A component to display while translations are in progress.   |
| `errorComponent` | `Function` | `Error handler`| A component to render when a translation error occurs.       |

#### **Example**

```jsx
import React from 'react';
import { PolygotProvider } from 'Polygot';
import App from './App';

const CustomLoader = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    <span className="ml-2">Translating...</span>
  </div>
);

const CustomError = ({ error }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-800">Translation Error: {error.message}</p>
  </div>
);

function Root() {
  return (
    <PolygotProvider
      sourceLanguage="en"
      apiKey={process.env.REACT_APP_TRANSLATION_API_KEY}
      loadingComponent={<CustomLoader />}
      errorComponent={CustomError}
    >
      <App />
    </PolygotProvider>
  );
}

export default Root;
```

---

### 🔹 usePolygot

A React hook that provides access to translation functions and the current language state.

#### **Return Values**

| Property     | Type                      | Description                                             |
|--------------|---------------------------|---------------------------------------------------------|
| `t`          | `(text: string) => string`| Function to translate a string of text.                 |
| `setLanguage`| `(lang: string) => void`  | Function to set the target translation language.        |
| `language`   | `string`                  | The current target language.                            |
| `isLoading`  | `boolean`                 | Indicates if translations are currently loading.        |
| `error`      | `string \| null`          | Any error message from the translation service.         |

#### **Example**

```jsx
import React from 'react';
import { usePolygot } from 'Polygot';

function LanguageSwitcher() {
  const { t, setLanguage, language, isLoading, error } = usePolygot();

  const handleLanguageChange = (e) => {
    try {
      setLanguage(e.target.value);
    } catch (err) {
      console.error('Invalid language code:', err.message);
    }
  };

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <h1>{t('Welcome to our platform')}</h1>

      <div className="flex items-center gap-2">
        <select
          value={language}
          onChange={handleLanguageChange}
          disabled={isLoading}
          className="border rounded px-3 py-2"
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
        </select>

        {isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        )}
      </div>

      <p>{t('Choose your preferred language from the dropdown above.')}</p>
    </div>
  );
}
```

---

### 🔹 `<Polygot>`

This component automatically translates all text content within its children.

#### **How It Works**

1. **String Extraction**: Traverses the DOM to extract text from children.
2. **Translation**: Sends the extracted text to the translation service.
3. **Content Replacement**: Replaces original text with translated text while preserving structure.

#### **Example**

```jsx
import React from 'react';
import { Polygot } from 'Polygot';

function ProductCard() {
  return (
    <div className="product-card">
      <Polygot>
        <div className="header">
          <h2>Premium Subscription</h2>
          <span className="badge">Popular</span>
        </div>
        <ul className="features">
          <li>Unlimited translations</li>
          <li>Priority support</li>
          <li>Advanced analytics</li>
        </ul>
        <button className="btn-primary">Subscribe Now</button>
      </Polygot>
    </div>
  );
}
```

---

### 🔹 `<NoPolygot>`

Use this component to prevent its children from being translated. This is useful for content that should remain in its original language.

#### **Common Use Cases**

- **Contact Information**: Email addresses, phone numbers
- **Brand Names**: Company or product names
- **Technical Jargon**: Code snippets, API endpoints
- **Proper Nouns**: Names of people or places

#### **Example**

```jsx
import React from 'react';
import { Polygot, NoPolygot } from 'Polygot';

function ContactInfo() {
  return (
    <Polygot>
      <div className="contact-section">
        <h2>Contact Us</h2>
        <p>We'd love to hear from you!</p>

        {/* This content will NOT be translated */}
        <NoPolygot>
          <div className="contact-details">
            <p>Email: support@acmecorp.com</p>
            <p>Phone: +1 (555) 123-4567</p>
          </div>
        </NoPolygot>

        {/* This content WILL be translated */}
        <div className="hours">
          <h3>Business Hours</h3>
          <p>Available Monday through Friday, 9am to 5pm</p>
        </div>
      </div>
    </Polygot>
  );
}
```
