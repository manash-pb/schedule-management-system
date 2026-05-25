import React, { useRef, useEffect } from 'react';

const PlaceAutocompleteInput = ({ apiKey, value, onChange, onPlaceSelected, placeholder, className, style, required }) => {
    const inputRef = useRef(null);
    const autocompleteRef = useRef(null);

    const onPlaceSelectedRef = useRef(onPlaceSelected);
    useEffect(() => {
        onPlaceSelectedRef.current = onPlaceSelected;
    }, [onPlaceSelected]);

    useEffect(() => {
        let mounted = true;
        if (!apiKey) return;

        // loadGoogleMapsScript inline fallback or import
        const loadScript = (key) => {
            return new Promise((resolve, reject) => {
                if (window.google && window.google.maps && window.google.maps.places) {
                    resolve();
                    return;
                }
                const existingScript = document.getElementById('google-maps-script');
                if (existingScript) {
                    existingScript.addEventListener('load', resolve);
                    existingScript.addEventListener('error', reject);
                    return;
                }
                const script = document.createElement('script');
                script.id = 'google-maps-script';
                script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
                script.async = true;
                script.defer = true;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        };

        loadScript(apiKey)
            .then(() => {
                if (!mounted || !inputRef.current) return;
                if (autocompleteRef.current) return;

                const createAutocomplete = () => {
                    const element = new window.google.maps.places.Autocomplete(inputRef.current, {
                        fields: ['name', 'formatted_address'],
                    });

                    element.addListener('place_changed', () => {
                        const place = element.getPlace();
                        if (place && onPlaceSelectedRef.current) {
                            onPlaceSelectedRef.current(place);
                        }
                    });

                    autocompleteRef.current = element;
                };

                if (window.google && window.google.maps && window.google.maps.places) {
                    createAutocomplete();
                }
            })
            .catch((error) => {
                console.error('Error loading Google Maps script:', error);
            });

        return () => {
            mounted = false;
        };
    }, [apiKey]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    return (
        <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={className}
            style={style}
            required={required}
        />
    );
};

export default PlaceAutocompleteInput;
