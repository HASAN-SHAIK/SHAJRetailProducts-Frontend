const SearchBar = ({ value, onChange, placeholder }) => {
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mobile-field"
        style={{ paddingLeft: 34 }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 11,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 13,
          opacity: 0.7,
        }}
      >
        ?
      </span>
    </div>
  );
};

export default SearchBar;
